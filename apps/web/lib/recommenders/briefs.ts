import "server-only";

import { createHash } from "node:crypto";
import {
  consumeEntitlement,
  failLorBrief,
  getKit,
  getLorPlan,
  getRecommender,
  listDeliverables,
  listKits,
  listLorBriefs,
  listLorStories,
  listRecommenders,
  listUserSchools,
  markLorBriefBuilding,
  releaseEntitlement,
  saveLorBrief,
  saveLorPlan,
  type DbExecutor,
  type LorBriefRow,
  type LorPlanRow,
  type LorStoryRow,
  type RecommenderRow,
} from "@admitstory/db";
import type { TaskInput } from "@admitstory/ai";
import {
  COMMON_GROUP_KEY,
  planReminders,
  schoolGroups,
  type BriefMeta,
  type BriefSummary,
  type LorAssignment,
  type LorPlan,
} from "@admitstory/shared/kit";
import type { TraitId } from "@admitstory/shared";
import { ApiError } from "@/lib/api";
import { ai } from "@/lib/ai";
import type { LorBriefRequested } from "@/inngest/events";
import { lorBriefRequested } from "@/inngest/events";
import type { KitAI } from "@/lib/kit/pipeline";
import { dispatch } from "@/lib/strategy/dispatch";
import { ensureSnapshot } from "@/lib/strategy/jobs";
import {
  applicantIdentity,
  groupable,
  howToSubmitFor,
  recommenderSchools,
  type ApplicantIdentity,
  type RecommenderSchool,
} from "./schools";

// Recommender briefs (spec §5.11, plan §7, decisions 14 and 19): the coverage plan across the
// applicant's recommenders (`lor.plan`) and one brief per recommender per school group
// (`lor.brief`). The deterministic half of a brief — deadlines, how to submit, the questions
// verbatim, the own-words reminder, the timeline — is code and lives in `BriefMeta`; the model
// only writes the talking points.
//
// Cost (decision 19): the first brief of a group comes with the kit, a rebuild whose inputs
// changed costs one refinement of the group's first paid school (released when the build fails),
// and a rebuild whose inputs are unchanged returns what is stored, free.

/** Never ask the model for more of the applicant's stories than a letter can hold. */
const STORIES_MAX = 12;
/** `lor.plan` takes at most four recommenders (schemas/lor.ts). */
const PLAN_RECOMMENDERS_MAX = 4;

const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);

const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/* Loading -------------------------------------------------------------------------------------- */

export interface BriefGroup {
  key: string;
  schools: RecommenderSchool[];
}

/** Everything the brief builder and the views need about one recommender. */
export interface RecommenderContext {
  recommender: RecommenderRow;
  identity: ApplicantIdentity;
  /** The schools this recommender writes for, in the applicant's order. */
  schools: RecommenderSchool[];
  groups: BriefGroup[];
  stories: LorStoryRow[];
  briefs: LorBriefRow[];
  /** True when the applicant is reapplying to any school in the group (LOR-07). */
  isReapplicant: boolean;
}

/** Null when the recommender isn't the caller's (the routes answer 404, never 403). */
export async function loadRecommenderContext(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
): Promise<RecommenderContext | null> {
  const recommender = await getRecommender(db, userId, recommenderId);
  if (!recommender) return null;
  const [identity, schools, stories, briefs, rows] = await Promise.all([
    applicantIdentity(db, userId),
    recommenderSchools(db, userId, { userSchoolIds: recommender.userSchoolIds }),
    listLorStories(db, userId, { recommenderId: recommender.id }),
    listLorBriefs(db, userId, { recommenderId: recommender.id }),
    listUserSchools(db, userId),
  ]);
  const mine = new Set(recommender.userSchoolIds);
  const byId = new Map(schools.map((s) => [s.schoolCycleId, s]));
  const groups = schoolGroups(schools.map(groupable)).map((g) => ({
    key: g.key,
    schools: g.schoolCycleIds.flatMap((id) => {
      const school = byId.get(id);
      return school ? [school] : [];
    }),
  }));
  return {
    recommender,
    identity,
    schools,
    groups,
    stories,
    briefs,
    isReapplicant: rows.some((r) => mine.has(r.id) && r.isReapplicant),
  };
}

/* The coverage plan (`lor.plan`) ---------------------------------------------------------------- */

interface PlanSubject {
  row: RecommenderRow;
  stories: LorStoryRow[];
}

async function planSubjects(db: DbExecutor, userId: string): Promise<PlanSubject[]> {
  const [rows, stories] = await Promise.all([
    listRecommenders(db, userId),
    listLorStories(db, userId),
  ]);
  return rows
    .map((row) => ({ row, stories: stories.filter((s) => s.recommenderId === row.id) }))
    .filter((subject) => subject.stories.length > 0)
    .slice(0, PLAN_RECOMMENDERS_MAX);
}

/** Each of the applicant's schools by the id its kits point at, for labelling essays. */
async function schoolNamesOf(db: DbExecutor, userId: string): Promise<Map<string, string>> {
  const rows = await listUserSchools(db, userId);
  return new Map(rows.map((row) => [row.id, row.school.shortName || row.school.name]));
}

/** The essays across every kit, so a recommender's facet never repeats one (LOR-03). */
async function planEssays(
  db: DbExecutor,
  userId: string,
): Promise<TaskInput<"lor.plan">["essays"]> {
  const [kits, schoolNames] = await Promise.all([listKits(db, userId), schoolNamesOf(db, userId)]);
  const essays = await Promise.all(
    kits.map(async (kit) => {
      const deliverables = await listDeliverables(db, userId, kit.id);
      const map = (kit.fileMap ?? {}) as { items?: unknown };
      const items = Array.isArray(map.items)
        ? (map.items as {
            deliverable_key: string;
            primary_story: string | null;
            traits_shown?: string[];
          }[])
        : [];
      const school = schoolNames.get(kit.userSchoolId) ?? "";
      return (deliverables ?? [])
        .filter((d) => d.type === "essay" || d.type === "short_answer")
        .map((d) => {
          const item = items.find((i) => i.deliverable_key === d.packKey);
          return {
            school,
            key: d.packKey,
            title: d.title ?? d.packKey,
            primary_story: item?.primary_story ?? null,
            traits_shown: ((item?.traits_shown ?? []) as TraitId[]).slice(0, 6),
          };
        });
    }),
  );
  return essays.flat().slice(0, 40);
}

/** The file maps' recommender hints and the red flags the Strategist left to a recommender. */
async function planHints(
  db: DbExecutor,
  userId: string,
): Promise<{
  kit_plans: TaskInput<"lor.plan">["kit_plans"];
  red_flags: TaskInput<"lor.plan">["red_flags"];
}> {
  const kits = await listKits(db, userId);
  const rows = await Promise.all(kits.map((kit) => getKit(db, userId, kit.id)));
  const kitPlans = new Map<
    string,
    { recommender_id: string; strengths: TraitId[]; stories: string[]; facets: string[] }
  >();
  const redFlags = new Map<string, { flag: string; how: string }>();
  for (const row of rows) {
    const map = (row?.fileMap ?? {}) as { recommender_plan?: unknown };
    for (const plan of Array.isArray(map.recommender_plan) ? map.recommender_plan : [])
      if (
        plan &&
        typeof plan === "object" &&
        typeof (plan as { recommender_id?: unknown }).recommender_id === "string"
      ) {
        const p = plan as {
          recommender_id: string;
          strengths?: TraitId[];
          stories?: string[];
          facets?: string[];
        };
        kitPlans.set(p.recommender_id, {
          recommender_id: p.recommender_id,
          strengths: (p.strengths ?? []).slice(0, 6),
          stories: (p.stories ?? []).slice(0, 12),
          facets: (p.facets ?? []).map((f) => f.slice(0, 300)).slice(0, 12),
        });
      }
    const positioning = (row?.positioning ?? {}) as { red_flags?: unknown };
    for (const flag of Array.isArray(positioning.red_flags) ? positioning.red_flags : [])
      if (flag && typeof flag === "object") {
        const f = flag as { flag?: string; address_in?: string; how?: string };
        if (f.address_in === "recommender" && f.flag && f.how)
          redFlags.set(f.flag, { flag: f.flag.slice(0, 300), how: f.how.slice(0, 600) });
      }
  }
  return {
    kit_plans: [...kitPlans.values()].slice(0, 16),
    red_flags: [...redFlags.values()].slice(0, 8),
  };
}

function planInput(
  subjects: readonly PlanSubject[],
  essays: TaskInput<"lor.plan">["essays"],
  hints: {
    kit_plans: TaskInput<"lor.plan">["kit_plans"];
    red_flags: TaskInput<"lor.plan">["red_flags"];
  },
): TaskInput<"lor.plan"> {
  return {
    recommenders: subjects.map(({ row, stories }) => ({
      ref: row.ref,
      relationship: row.relationship,
      title: row.title,
      duration: row.durationText,
      frequency: row.frequencyText,
      strengths: (row.intake?.strengths ?? []).map((s) => s.trait).slice(0, 6),
      stories: stories.slice(0, STORIES_MAX).map((s) => ({
        code: s.code,
        title: s.fields.title,
        traits: s.fields.traits.slice(0, 4),
        cites: s.fields.cites.slice(0, 8),
      })),
    })),
    essays,
    kit_plans: hints.kit_plans,
    red_flags: hints.red_flags,
  };
}

/** The stored plan and whether its inputs moved on, for the Coverage tab (read-only). */
export async function planStatus(
  db: DbExecutor,
  userId: string,
): Promise<{ row: LorPlanRow | null; stale: boolean }> {
  const [row, subjects] = await Promise.all([getLorPlan(db, userId), planSubjects(db, userId)]);
  if (!row) return { row: null, stale: false };
  if (subjects.length === 0) return { row, stale: false };
  const [essays, hints] = await Promise.all([planEssays(db, userId), planHints(db, userId)]);
  return { row, stale: row.inputHash !== hash(planInput(subjects, essays, hints)) };
}

/**
 * The coverage plan, written again only when its inputs changed (or `force`). Null when nobody has
 * a story yet. The plan is free: the route that asks for it is rate-limited instead (decision 19).
 */
export async function ensurePlan(
  deps: { ai: KitAI; db: DbExecutor },
  userId: string,
  options: { force?: boolean } = {},
): Promise<LorPlanRow | null> {
  const subjects = await planSubjects(deps.db, userId);
  if (subjects.length === 0) return null;
  const [essays, hints, existing] = await Promise.all([
    planEssays(deps.db, userId),
    planHints(deps.db, userId),
    getLorPlan(deps.db, userId),
  ]);
  const input = planInput(subjects, essays, hints);
  const inputHash = hash(input);
  if (!options.force && existing && existing.inputHash === inputHash) return existing;
  const snapshot = await ensureSnapshot(userId);
  const content = await deps.ai.run("lor.plan", input, {
    userId,
    dossier: snapshot.compactText,
  });
  return saveLorPlan(deps.db, userId, {
    content,
    inputHash,
    dossierSnapshotVersion: snapshot.version,
  });
}

/** This recommender's assignment, or one derived from their own stories before a plan exists. */
export function assignmentFor(
  plan: LorPlan | null,
  recommender: RecommenderRow,
  stories: readonly LorStoryRow[],
): LorAssignment {
  const assigned = plan?.assignments.find((a) => a.recommender === recommender.ref);
  if (assigned) return assigned;
  const traits = [
    ...new Set([
      ...(recommender.intake?.strengths ?? []).map((s) => s.trait),
      ...stories.flatMap((s) => s.fields.traits),
    ]),
  ].slice(0, 3);
  return {
    recommender: recommender.ref,
    strengths: traits,
    stories: stories.map((s) => s.code).slice(0, 10),
    facets: stories.slice(0, 10).map((s) => ({
      story: s.code,
      facet: s.fields.title,
      evidence: s.fields.what_they_saw,
    })),
    avoid: [],
  };
}

/* One brief ------------------------------------------------------------------------------------- */

function briefInput(
  ctx: RecommenderContext,
  group: BriefGroup,
  plan: LorPlan | null,
): TaskInput<"lor.brief"> {
  const r = ctx.recommender;
  const assignment = assignmentFor(plan, r, ctx.stories);
  const others = (plan?.assignments ?? [])
    .filter((a) => a.recommender !== r.ref)
    .slice(0, 3)
    .map((a) => ({
      ref: a.recommender,
      relationship: r.relationship,
      strengths: a.strengths.slice(0, 5),
      facets: a.facets.map((f) => f.facet).slice(0, 10),
    }));
  const note = r.intake?.relationship ?? null;
  return {
    recommender: {
      ref: r.ref,
      name: r.name,
      relationship: r.relationship,
      title: r.title,
      organisation: r.organisation,
      duration: r.durationText,
      frequency: r.frequencyText,
      knows_mba: r.intake?.background.knows_mba ?? "unknown",
    },
    applicant_first_name: ctx.identity.firstName,
    schools: group.schools.map((s) => ({
      school_cycle_id: s.schoolCycleId,
      school: s.name,
      questions: s.questions.map((q) => ({ id: q.id, text_verbatim: q.text })),
    })),
    assignment,
    others,
    stories: ctx.stories.slice(0, STORIES_MAX).map((s) => ({ code: s.code, ...s.fields })),
    relationship_note: note && note.summary ? note : null,
    growth: r.intake?.growth ?? null,
    red_flags: [],
    is_reapplicant: ctx.isReapplicant,
  };
}

/** The deterministic half of a brief (decision 14): dates, how to submit, the questions verbatim. */
export function briefMetaFor(
  ctx: RecommenderContext,
  group: BriefGroup,
  now: Date = new Date(),
): BriefMeta {
  const planned = planReminders({
    today: now.toISOString().slice(0, 10),
    deadlines: ctx.schools.flatMap((s) =>
      s.deadline ? [{ schoolCycleId: s.schoolCycleId, date: s.deadline }] : [],
    ),
  });
  return {
    applicant: { name: ctx.identity.name, firstName: ctx.identity.firstName },
    recommender: {
      name: ctx.recommender.name,
      firstName: firstNameOf(ctx.recommender.name),
      title: ctx.recommender.title,
      organisation: ctx.recommender.organisation,
    },
    groupKey: group.key,
    schools: group.schools.map((s) => ({
      schoolCycleId: s.schoolCycleId,
      school: s.name,
      round: s.round,
      deadline: s.deadline,
      format: s.format,
      howToSubmit: howToSubmitFor(s, ctx.identity.firstName),
      packNotes: [...s.packNotes],
      questions: s.questions.map((q) => ({
        id: q.id,
        text: q.text,
        limit: q.limit,
        source: q.source,
      })),
    })),
    askBy: planned.find((p) => p.kind === "ask")?.sendOn ?? null,
    checkIns: [...new Set(planned.filter((p) => p.kind !== "ask").map((p) => p.sendOn))].sort(),
    builtAt: now.toISOString(),
  };
}

/**
 * What a rebuild would send the model, hashed: the stories, the plan's assignment, the group's
 * questions and the dossier it was written from. A brief whose hash moved on is stale.
 */
export function briefInputHash(
  ctx: RecommenderContext,
  group: BriefGroup,
  plan: LorPlan | null,
  dossierSnapshotVersion: number | null,
): string {
  return hash({
    input: briefInput(ctx, group, plan),
    meta: briefMetaFor(ctx, group, new Date(0)),
    dossier: dossierSnapshotVersion,
  });
}

/** Whether a stored brief still matches its inputs. */
export function briefIsStale(row: LorBriefRow | undefined, currentHash: string): boolean {
  return Boolean(row && row.status === "ready" && row.inputHash !== currentHash);
}

export function briefSummaryOf(
  group: BriefGroup,
  row: LorBriefRow | undefined,
  currentHash: string,
): BriefSummary {
  return {
    groupKey: group.key,
    schools: group.schools.map((s) => s.name),
    status: row?.status ?? "none",
    stale: briefIsStale(row, currentHash),
    builtAt: row?.builtAt?.toISOString() ?? null,
    // The first brief of a group comes with the kit; a later rebuild costs a refinement.
    costsRefinement: (row?.version ?? 0) > 0,
  };
}

/** The group's schools the applicant has paid for; the first one pays for a rebuild. */
const paidSchools = (group: BriefGroup) => group.schools.filter((s) => s.paid);

/**
 * Queues one recommender's briefs (every group, or one): marks them building, charges a refinement
 * when the inputs changed (decision 19), and dispatches `lor/brief.requested`. The kit pipeline
 * passes `reason: "kit_stage"` and builds the queued groups itself, inside the job it is already
 * running (`briefsForKit`); nothing is dispatched for it.
 */
export async function requestBriefs(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  options: { groupKey?: string; reason: "applicant" | "kit_stage" },
): Promise<BriefSummary[]> {
  const ctx = await loadRecommenderContext(db, userId, recommenderId);
  if (!ctx) return [];
  const groups = options.groupKey
    ? ctx.groups.filter((g) => g.key === options.groupKey)
    : ctx.groups;
  if (options.groupKey && groups.length === 0)
    throw new ApiError(404, "That brief could not be found.");
  if (groups.length === 0) return [];
  if (ctx.stories.length === 0)
    throw new ApiError(
      422,
      `Tell ${firstNameOf(ctx.recommender.name)}'s stories first, and the brief follows.`,
    );

  const [plan, snapshot] = await Promise.all([getLorPlan(db, userId), ensureSnapshot(userId)]);
  const summaries: BriefSummary[] = [];
  const queued: string[] = [];
  for (const group of groups) {
    const row = ctx.briefs.find((b) => b.groupKey === group.key);
    const currentHash = briefInputHash(ctx, group, plan?.content ?? null, snapshot.version);
    if (row?.status === "building" || (row?.status === "ready" && row.inputHash === currentHash)) {
      summaries.push(briefSummaryOf(group, row, currentHash));
      continue;
    }
    const [payer] = paidSchools(group);
    if (!payer)
      throw new ApiError(
        402,
        group.key === COMMON_GROUP_KEY
          ? "Unlock a School Kit and your recommenders get their briefs."
          : `Unlock the ${group.schools[0]?.name ?? "school"} kit and its brief comes with it.`,
      );
    let chargedRefId: string | null = null;
    if ((row?.version ?? 0) > 0) {
      const counter = { refId: payer.schoolCycleId, counter: "revisions" } as const;
      const used = await consumeEntitlement(db, userId, counter);
      if (!used.ok)
        throw new ApiError(
          402,
          used.reason === "limit_reached"
            ? `You've used all ${used.limit} refinements for the ${payer.name} kit.`
            : `Your access to the ${payer.name} kit has ended.`,
        );
      chargedRefId = counter.refId;
    }
    const building = await markLorBriefBuilding(db, userId, ctx.recommender.id, {
      groupKey: group.key,
      schoolCycleIds: group.schools.map((s) => s.schoolCycleId),
      inputHash: currentHash,
      chargedRefId,
    });
    queued.push(group.key);
    summaries.push(briefSummaryOf(group, building ?? row, currentHash));
  }

  if (queued.length > 0 && options.reason === "applicant") {
    const data: LorBriefRequested = {
      userId,
      recommenderId: ctx.recommender.id,
      groupKeys: queued,
      reason: options.reason,
    };
    await dispatch(lorBriefRequested.create(data), () => runBriefJob({ ai: ai(), db }, data));
  }
  return summaries;
}

/** The `lor/brief` job: the plan when its inputs changed, then `lor.brief` per group. */
export async function runBriefJob(
  deps: { ai: KitAI; db: DbExecutor },
  data: LorBriefRequested,
): Promise<{ built: string[]; failed: string[] }> {
  const { db } = deps;
  const ctx = await loadRecommenderContext(db, data.userId, data.recommenderId);
  if (!ctx) return { built: [], failed: [] };

  let plan: LorPlanRow | null = null;
  try {
    plan = await ensurePlan(deps, data.userId);
  } catch (error) {
    // A brief is better than none: fall back to the stored plan, or to the recommender's stories.
    console.error("[lor] the coverage plan failed; building from the stories", error);
    plan = await getLorPlan(db, data.userId);
  }
  const snapshot = await ensureSnapshot(data.userId);
  const built: string[] = [];
  const failed: string[] = [];
  for (const groupKey of data.groupKeys) {
    const group = ctx.groups.find((g) => g.key === groupKey);
    if (!group) continue;
    const row = ctx.briefs.find((b) => b.groupKey === groupKey);
    const chargedRefId = row?.chargedRefId ?? null;
    try {
      const input = briefInput(ctx, group, plan?.content ?? null);
      await markLorBriefBuilding(db, data.userId, ctx.recommender.id, {
        groupKey,
        schoolCycleIds: group.schools.map((s) => s.schoolCycleId),
        inputHash: briefInputHash(ctx, group, plan?.content ?? null, snapshot.version),
        chargedRefId,
      });
      const content = await deps.ai.run("lor.brief", input, {
        userId: data.userId,
        dossier: snapshot.compactText,
      });
      await saveLorBrief(db, data.userId, ctx.recommender.id, groupKey, {
        content,
        meta: briefMetaFor(ctx, group),
        planVersion: plan?.version ?? null,
        dossierSnapshotVersion: snapshot.version,
      });
      built.push(groupKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[lor] brief ${groupKey} failed`, error);
      await failLorBrief(db, data.userId, ctx.recommender.id, groupKey, message);
      // Nothing was written, so the refinement isn't spent (decision 19).
      if (chargedRefId)
        await releaseEntitlement(db, data.userId, { refId: chargedRefId, counter: "revisions" });
      failed.push(groupKey);
    }
  }
  return { built, failed };
}
