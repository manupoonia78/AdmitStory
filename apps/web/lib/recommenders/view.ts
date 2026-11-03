import "server-only";

import {
  getCurrentDraft,
  getDb,
  getLatestSnapshot,
  getSources,
  isPaidUser,
  listDeliverables,
  listDismissedFindings,
  listFacts,
  listGoldenLines,
  listKits,
  listUserSchools,
  listLorBriefs,
  listLorStories,
  listPeople,
  listRecommenderStatuses,
  listRecommenders,
  listStories,
  type DbExecutor,
  type LorStoryRow,
  type RecommenderStatusRow,
} from "@admitstory/db";
import {
  checkLorOverlap,
  type LorEssayFacet,
  type LorFacetPoint,
  type LorOverlapFinding,
} from "@admitstory/linters";
import {
  INTAKE_QUESTION_IDS,
  RECOMMENDER_STATUS_LABELS,
  recommenderStatusOf,
  type BriefView,
  type Cite,
  type CoverageView,
  type IntakeQuestionId,
  type LorOverlapFindingView,
  type Paragraph,
  type RecommenderDetailView,
  type RecommenderStatus,
  type RecommendersPageView,
} from "@admitstory/shared/kit";
import { shortDate } from "@/lib/strategy/pack";
import {
  assignmentFor,
  briefInputHash,
  briefIsStale,
  briefSummaryOf,
  loadRecommenderContext,
  planStatus,
  type RecommenderContext,
} from "./briefs";
import { recommenderSchools } from "./schools";

// What screen H shows (spec §6.10 H, plan §3 view shapes). The applicant's own material and the
// status of each recommender: dates and marks, never a note, a letter or the portal link (§14.3,
// decision 7).
//
// Staleness is read from the last saved dossier snapshot rather than by building a new one, so a
// read never writes.

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const iso = (at: Date | null | undefined) => at?.toISOString() ?? null;

function statusOf(row: RecommenderStatusRow | undefined, schoolCycleIds: readonly string[]) {
  const submitted = { ...(row?.submitted ?? {}) };
  const status = recommenderStatusOf({
    invite: row?.invite
      ? { status: row.invite.status, sentAt: row.invite.sentAt.toISOString() }
      : null,
    openedAt: iso(row?.openedAt),
    progressAt: iso(row?.progressAt),
    submitted,
    schoolCycleIds,
  });
  return { status, submitted, row };
}

/** "Invited 12 Oct 2026", "Opened 13 Oct 2026", "Marked submitted". */
function statusLine(status: RecommenderStatus, row: RecommenderStatusRow | undefined): string {
  const label = RECOMMENDER_STATUS_LABELS[status];
  const date =
    status === "invited"
      ? iso(row?.invite?.sentAt)
      : status === "opened"
        ? iso(row?.openedAt)
        : status === "in_progress"
          ? iso(row?.progressAt)
          : null;
  return date ? `${label} ${shortDate(date.slice(0, 10))}` : label;
}

/* The list ------------------------------------------------------------------------------------- */

/** Screen H's list (GET /api/recommenders). Status only, never what a recommender wrote. */
/**
 * The clock for one page render. Read here rather than in the page component, so the component
 * itself stays pure (the house rule the React compiler lints for).
 */
export function pageNow(now: Date = new Date()): number {
  return now.getTime();
}

export async function loadRecommendersPage(userId: string): Promise<RecommendersPageView> {
  const db = getDb();
  const [paid, people, statuses, schools, stories, suggestions] = await Promise.all([
    isPaidUser(db, userId),
    listRecommenders(db, userId),
    listRecommenderStatuses(db, userId),
    recommenderSchools(db, userId),
    listLorStories(db, userId),
    listPeople(db, userId),
  ]);
  const cycleOf = new Map(schools.map((s) => [s.userSchoolId, s.schoolCycleId]));
  const nameOf = new Map(schools.map((s) => [s.userSchoolId, s.name]));
  const taken = new Set(people.map((p) => p.name.trim().toLowerCase()));
  return {
    state: paid ? "ready" : "locked",
    recommenders: people.map((person) => {
      const schoolCycleIds = person.userSchoolIds.flatMap((id) => {
        const cycle = cycleOf.get(id);
        return cycle ? [cycle] : [];
      });
      const { status, row } = statusOf(
        statuses.find((s) => s.recommenderId === person.id),
        schoolCycleIds,
      );
      return {
        id: person.id,
        name: person.name,
        relationship: person.relationship,
        title: person.title,
        organisation: person.organisation,
        schools: person.userSchoolIds.flatMap((id) => {
          const name = nameOf.get(id);
          return name ? [{ userSchoolId: id, name }] : [];
        }),
        stories: stories.filter((s) => s.recommenderId === person.id).length,
        status,
        statusLine: statusLine(status, row),
      };
    }),
    schools: schools.map((s) => ({
      userSchoolId: s.userSchoolId,
      name: s.name,
      needed: s.needed,
      paid: s.paid,
    })),
    suggestions: suggestions
      .filter((p) => !taken.has(p.name.trim().toLowerCase()))
      .slice(0, 6)
      .map((p) => ({ name: p.name, role: p.roleInLife })),
  };
}

/* Coverage and the overlap check (decision 17) ------------------------------------------------- */

/** Every ready brief's talking points, flattened for the deterministic overlap check. */
async function facetPoints(db: DbExecutor, userId: string): Promise<LorFacetPoint[]> {
  const [people, briefs] = await Promise.all([
    listRecommenders(db, userId),
    listLorBriefs(db, userId),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, firstNameOf(p.name)]));
  const points: LorFacetPoint[] = [];
  for (const row of briefs) {
    if (row.status !== "ready" || !row.content) continue;
    const label = nameOf.get(row.recommenderId);
    if (!label) continue;
    for (const school of row.content.schools)
      for (const question of school.questions)
        question.talking_points.forEach((point, index) =>
          points.push({
            recommenderId: row.recommenderId,
            recommenderLabel: label,
            groupKey: row.groupKey,
            questionId: question.question_id,
            index,
            story: point.story,
            trait: point.trait,
            facet: point.facet,
            text: `${point.point} ${point.evidence}`.trim(),
          }),
        );
  }
  return points;
}

interface EssayRow {
  deliverableId: string;
  label: string;
  school: string;
  primaryStory: string | null;
  traits: string[];
  paragraphs: { id: string; text: string; stories: string[] }[];
}

/** The applicant's essays and short answers, with the stories each paragraph tells. */
async function essayRows(db: DbExecutor, userId: string): Promise<EssayRow[]> {
  const [kits, schools] = await Promise.all([listKits(db, userId), listUserSchools(db, userId)]);
  const schoolNames = new Map(
    schools.map((row) => [row.id, row.school.shortName || row.school.name]),
  );
  const perKit = await Promise.all(
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
      return Promise.all(
        (deliverables ?? [])
          .filter((d) => d.type === "essay" || d.type === "short_answer")
          .map(async (d): Promise<EssayRow> => {
            const item = items.find((i) => i.deliverable_key === d.packKey);
            const draft = await getCurrentDraft(db, userId, d.id);
            const paragraphs = ((draft?.content.paragraphs ?? []) as Paragraph[]).map((p) => ({
              id: p.id,
              text: p.sentences.map((s) => s.text).join(" "),
              stories: [
                ...new Set(p.sentences.flatMap((s) => s.sources.filter((c) => /^S\d/.test(c)))),
              ],
            }));
            return {
              deliverableId: d.id,
              label: d.title ?? d.packKey,
              school,
              primaryStory: item?.primary_story ?? null,
              traits: item?.traits_shown ?? [],
              paragraphs,
            };
          }),
      );
    }),
  );
  return perKit.flat();
}

interface Overlap {
  finding: LorOverlapFinding;
  view: LorOverlapFindingView;
}

const briefHref = (recommenderId: string, groupKey: string) =>
  `/recommenders/${recommenderId}?tab=brief&group=${encodeURIComponent(groupKey)}`;

/** The overlap findings for every brief, as views with links to both places. */
async function overlaps(
  db: DbExecutor,
  userId: string,
  storyTitle: (code: string | null) => string,
): Promise<Overlap[]> {
  const [points, essays, dismissed] = await Promise.all([
    facetPoints(db, userId),
    essayRows(db, userId),
    listDismissedFindings(db, userId),
  ]);
  const input: LorEssayFacet[] = essays.map((e) => ({
    deliverableId: e.deliverableId,
    label: e.label,
    primaryStory: e.primaryStory,
    traits: e.traits,
    paragraphs: e.paragraphs,
  }));
  return checkLorOverlap({ points, essays: input, dismissed }).map((finding) => ({
    finding,
    view: {
      id: finding.id,
      kind: finding.kind,
      story: finding.story as Cite,
      storyTitle: storyTitle(finding.story),
      facet: finding.facet,
      places: [
        {
          label: `${finding.a.recommenderLabel}'s brief`,
          href: briefHref(finding.a.recommenderId, finding.a.groupKey),
        },
        "recommenderId" in finding.b
          ? {
              label: `${finding.b.recommenderLabel}'s brief`,
              href: briefHref(finding.b.recommenderId, finding.b.groupKey),
            }
          : { label: finding.b.label, href: `/workspace/${finding.b.deliverableId}` },
      ],
      explanation: finding.explanation,
      dismissed: dismissed.has(finding.id),
    },
  }));
}

/** Story titles for R codes (the recommender's stories) and S codes (the Dossier's). */
async function storyTitles(
  db: DbExecutor,
  userId: string,
): Promise<(code: string | null) => string> {
  const [lor, dossier] = await Promise.all([listLorStories(db, userId), listStories(db, userId)]);
  const titles = new Map<string, string>([
    ...lor.map((s) => [s.code, s.fields.title] as const),
    ...dossier.map((s) => [s.code, s.nickname] as const),
  ]);
  return (code) => (code ? (titles.get(code) ?? code) : "");
}

/** The two vantage points of the Coverage tab: a lane per recommender and the essays beneath. */
export async function loadCoverageView(userId: string): Promise<CoverageView> {
  const db = getDb();
  const [plan, people, stories, title, schools] = await Promise.all([
    planStatus(db, userId),
    listRecommenders(db, userId),
    listLorStories(db, userId),
    storyTitles(db, userId),
    recommenderSchools(db, userId),
  ]);
  const [essays, findings] = await Promise.all([
    essayRows(db, userId),
    overlaps(db, userId, title),
  ]);
  const schoolName = new Map(schools.map((s) => [s.schoolCycleId, s.name]));
  return {
    planVersion: plan.row?.version ?? null,
    planStale: plan.stale,
    lanes: people.map((person) => {
      const mine = stories.filter((s) => s.recommenderId === person.id);
      const assignment = assignmentFor(plan.row?.content ?? null, person, mine);
      return {
        recommenderId: person.id,
        name: person.name,
        relationship: person.relationship,
        strengths: assignment.strengths,
        facets: assignment.facets.map((f) => ({
          story: f.story,
          storyTitle: title(f.story),
          facet: f.facet,
          evidence: f.evidence,
        })),
      };
    }),
    essays: essays.map((e) => ({
      deliverableId: e.deliverableId,
      label: e.label,
      school: schoolName.get(e.school) ?? "",
      primaryStory: (e.primaryStory as Cite | null) ?? null,
      storyTitle: e.primaryStory ? title(e.primaryStory) : null,
      traits: e.traits as CoverageView["essays"][number]["traits"],
    })),
    findings: findings.map((f) => f.view),
  };
}

/* One recommender ------------------------------------------------------------------------------ */

const isQuestionId = (value: unknown): value is IntakeQuestionId =>
  typeof value === "string" && (INTAKE_QUESTION_IDS as readonly string[]).includes(value);

async function intakeAnswers(
  db: DbExecutor,
  userId: string,
  sourceIds: readonly string[],
): Promise<RecommenderDetailView["intake"]["answers"]> {
  if (sourceIds.length === 0) return [];
  const rows = await getSources(db, userId, sourceIds);
  return rows
    .filter((row) => row.kind === "recommender_intake" && row.text !== null)
    .map((row) => {
      const meta = (row.meta ?? {}) as { questionId?: unknown; spoken?: unknown };
      return {
        id: row.id,
        questionId: isQuestionId(meta.questionId) ? meta.questionId : "stories",
        text: row.text ?? "",
        spoken: Boolean(meta.spoken) || row.language !== null,
        at: row.createdAt.toISOString(),
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

function storyViews(rows: readonly LorStoryRow[]): RecommenderDetailView["stories"] {
  return rows.map((row) => ({ ...row.fields, id: row.id, code: row.code, origin: row.origin }));
}

/** The brief summaries of one recommender, with the group's current input hash for staleness. */
async function briefSummaries(db: DbExecutor, ctx: RecommenderContext) {
  const [plan, snapshot] = await Promise.all([
    planStatus(db, ctx.recommender.userId),
    getLatestSnapshot(db, ctx.recommender.userId),
  ]);
  return ctx.groups.map((group) => {
    const row = ctx.briefs.find((b) => b.groupKey === group.key);
    return briefSummaryOf(
      group,
      row,
      briefInputHash(ctx, group, plan.row?.content ?? null, snapshot?.version ?? null),
    );
  });
}

/** One recommender: details, intake, stories, briefs and coverage. Null when not the caller's. */
export async function loadRecommenderDetail(
  userId: string,
  recommenderId: string,
): Promise<RecommenderDetailView | null> {
  const db = getDb();
  const ctx = await loadRecommenderContext(db, userId, recommenderId);
  if (!ctx) return null;
  const r = ctx.recommender;
  const [answers, paid, briefs, coverage] = await Promise.all([
    intakeAnswers(db, userId, r.intakeSourceIds),
    isPaidUser(db, userId),
    briefSummaries(db, ctx),
    loadCoverageView(userId),
  ]);
  const lockedReason = !paid
    ? "Pulling the stories out of your answers comes with your first School Kit."
    : answers.length === 0
      ? `Answer a question or two about ${firstNameOf(r.name)} first.`
      : null;
  return {
    recommender: {
      id: r.id,
      ref: r.ref,
      name: r.name,
      email: r.email,
      title: r.title,
      organisation: r.organisation,
      relationship: r.relationship,
      durationText: r.durationText,
      frequencyText: r.frequencyText,
      userSchoolIds: [...r.userSchoolIds],
    },
    intake: {
      answers,
      extracted: r.intake ?? null,
      canExtract: lockedReason === null,
      lockedReason,
    },
    stories: storyViews(ctx.stories),
    briefs,
    coverage,
  };
}

/* One brief ------------------------------------------------------------------------------------ */

/** Labels for every cite a brief carries: facts, stories, golden lines and the R stories. */
async function citeLabels(
  db: DbExecutor,
  userId: string,
  ctx: RecommenderContext,
): Promise<Record<Cite, { label: string }>> {
  const [facts, stories, lines] = await Promise.all([
    listFacts(db, userId),
    listStories(db, userId),
    listGoldenLines(db, userId),
  ]);
  const labels: Record<string, { label: string }> = {};
  for (const fact of facts) labels[fact.code] = { label: fact.key.replace(/_/g, " ") };
  for (const story of stories) labels[story.code] = { label: story.nickname };
  for (const line of lines) labels[line.code] = { label: line.text.slice(0, 80) };
  for (const story of ctx.stories) labels[story.code] = { label: story.fields.title };
  return labels;
}

/** One brief with its deterministic meta, source labels and overlap findings. */
export async function loadBriefView(
  userId: string,
  recommenderId: string,
  groupKey: string,
): Promise<BriefView | null> {
  const db = getDb();
  const ctx = await loadRecommenderContext(db, userId, recommenderId);
  if (!ctx) return null;
  const group = ctx.groups.find((g) => g.key === groupKey);
  if (!group) return null;
  const row = ctx.briefs.find((b) => b.groupKey === groupKey);
  const [plan, snapshot, sources, title] = await Promise.all([
    planStatus(db, userId),
    getLatestSnapshot(db, userId),
    citeLabels(db, userId, ctx),
    storyTitles(db, userId),
  ]);
  const currentHash = briefInputHash(
    ctx,
    group,
    plan.row?.content ?? null,
    snapshot?.version ?? null,
  );
  const findings = row?.content ? await overlaps(db, userId, title) : [];
  const mine = findings.filter(
    (f) =>
      (f.finding.a.recommenderId === ctx.recommender.id && f.finding.a.groupKey === groupKey) ||
      ("recommenderId" in f.finding.b &&
        f.finding.b.recommenderId === ctx.recommender.id &&
        f.finding.b.groupKey === groupKey),
  );
  return {
    groupKey,
    status: row?.status ?? "none",
    stale: briefIsStale(row, currentHash),
    builtAt: iso(row?.builtAt),
    brief: row?.content ?? null,
    meta: row?.meta ?? null,
    sources,
    overlap: mine.map((f) => f.view),
  };
}
