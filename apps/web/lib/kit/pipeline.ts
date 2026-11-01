import "server-only";

import { applyPatches, selectEscalation, type AI, type RunContext } from "@admitstory/ai";
import {
  addVerifyItems,
  createDraftVersion,
  createNeedItems,
  getCurrentDraft,
  getCycleWithSchool,
  getKit,
  getKitContext,
  getKitStage,
  getVerifiedAiPolicy,
  listAngles,
  listDeliverables,
  listKitStages,
  saveAngles,
  saveKitOutputs,
  setKitStatus,
  updateDeliverable,
  upsertDeliverables,
  upsertKitStage,
  replaceChecks,
  type AngleRow,
  type DbExecutor,
  type Deliverable,
  type DraftRow,
  type KitContext,
  type KitStageKey,
  type NewCheck,
  type PublishedPack,
} from "@admitstory/db";
import type { SchoolPack } from "@admitstory/kb/types";
import {
  checkProvenance,
  count,
  limitStatus,
  runLinters,
  voiceFidelity,
  type DraftDoc,
  type Finding as LintFinding,
} from "@admitstory/linters";
import type {
  Angle,
  CoachBeats,
  Draft,
  FileMap,
  FileMapItem,
  Paragraph,
  Positioning,
  ShortformItem,
} from "@admitstory/shared/kit";
import { authorshipFor, DELIVERABLE_TYPE_OF, type AiStance } from "./authorship";
import { adviseForms } from "@/lib/forms/advise";
import { reviewLatestResume } from "@/lib/forms/resume";
import { packDeliverables, type PackDeliverable } from "@/lib/strategy/deliverables";
import { ensureSnapshot, retrieveForSchool } from "@/lib/strategy/jobs";
import { asPack } from "@/lib/strategy/pack";
import { latestPack } from "@/lib/strategy/server";

// The kit pipeline (spec §5.7): ten stages, each persisted to kit_stages before the next starts, so
// a crashed or retried run resumes where it stopped and never pays twice for a finished stage. The
// Inngest function runs each stage in its own step; without Inngest (local development) the same
// stages run in order after the webhook's response. Stage 9 runs the Form Advisor and the Résumé
// Pass (Phase 5); recommender briefs and the interview plan join it in Phases 6 and 7.

export type KitAI = Pick<AI, "run">;

export interface KitDeps {
  ai: KitAI;
  db: DbExecutor;
}

export interface KitRef {
  kitId: string;
  userId: string;
  /** Regenerate only these deliverables (a failed essay's retry). */
  only?: string[];
}

export const STAGE_ORDER: readonly KitStageKey[] = [
  "context",
  "positioning",
  "file_map",
  "gaps",
  "angles",
  "drafts",
  "short_form",
  "checks",
  "forms",
  "verify",
];

/** Long-form deliverables drafted one by one by kit.draft (stages 5–6). */
const LONG_TYPES = new Set(["essay"]);
/** Short items drafted together by kit.shortform (stage 7). */
const SHORT_TYPES = new Set(["short_answer", "goal_field", "video"]);
/** Mechanical limit fixes (§5.7 stage 8: "auto-fix mechanical issues up to 2 passes"). */
const AUTO_FIX_PASSES = 2;

export class KitNotFoundError extends Error {
  override name = "KitNotFoundError";
}

/* Loading --------------------------------------------------------------------------------------- */

export interface Loaded {
  ctx: KitContext;
  published: PublishedPack;
  pack: SchoolPack;
  snapshot: { version: number; compactText: string };
  run: RunContext;
}

export async function load(deps: KitDeps, ref: KitRef): Promise<Loaded> {
  const ctx = await getKitContext(deps.db, ref.userId, ref.kitId);
  if (!ctx) throw new KitNotFoundError(`Kit ${ref.kitId} not found for this user`);
  const published = await latestPack(deps.db, ctx.schoolCycleId);
  if (!published) throw new Error(`${ctx.school.name} has no published pack`);
  const snapshot = await ensureSnapshot(ref.userId);
  return {
    ctx,
    published,
    pack: asPack(published.data),
    snapshot,
    run: {
      userId: ref.userId,
      kitId: ref.kitId,
      schoolPack: published.compiledPrompt,
      schoolPackId: published.id,
      dossier: snapshot.compactText,
    },
  };
}

/** Runs `fn` once per kit and stage: a finished stage's stored output is returned instead. */
async function stage<T>(
  deps: KitDeps,
  ref: KitRef,
  key: KitStageKey,
  fn: () => Promise<T>,
  options: { rerun?: boolean } = {},
): Promise<T> {
  const existing = await getKitStage(deps.db, ref.userId, ref.kitId, key);
  if (!options.rerun && (existing?.status === "done" || existing?.status === "skipped"))
    return existing.output as T;
  await upsertKitStage(deps.db, ref.userId, ref.kitId, key, { status: "running" });
  try {
    const output = await fn();
    await upsertKitStage(deps.db, ref.userId, ref.kitId, key, {
      status: "done",
      output: output ?? null,
    });
    return output;
  } catch (error) {
    await upsertKitStage(deps.db, ref.userId, ref.kitId, key, {
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 500) : "unknown error",
    });
    throw error;
  }
}

/* Shapes ---------------------------------------------------------------------------------------- */

type LimitRule = { kind: "words" | "chars_incl_spaces" | "chars_excl_spaces"; value: number };

export function ruleOf(d: Pick<Deliverable, "limitKind" | "limitValue">): LimitRule | null {
  return d.limitKind && d.limitValue ? { kind: d.limitKind, value: d.limitValue } : null;
}

/** A deliverable as the writers see it (WritingDeliverable). */
export function writingDeliverable(d: Deliverable, source: PackDeliverable | undefined) {
  const kind = source?.kind ?? (d.type === "lor_question" ? "recommendation_question" : d.type);
  return {
    key: d.packKey,
    kind: kind as PackDeliverable["kind"],
    prompt: d.promptText,
    parts: (d.parts ?? []).map((p) => p.part).slice(0, 8),
    limit: ruleOf(d),
    list_items: source?.listCount && source.listCount >= 2 ? Math.min(source.listCount, 15) : null,
    archetypes: (source?.archetypes ?? []).slice(0, 4),
    pack_code: null,
  };
}

function storedFileMap(raw: unknown): FileMap {
  const map = (raw ?? {}) as Partial<FileMap>;
  return {
    items: map.items ?? [],
    recommender_plan: map.recommender_plan ?? [],
    coverage_gaps: map.coverage_gaps ?? [],
    warnings: map.warnings ?? [],
  };
}

function fileMapItem(map: FileMap, key: string): FileMapItem {
  return (
    map.items.find((item) => item.deliverable_key === key) ?? {
      deliverable_key: key,
      primary_story: null,
      primary_reason_if_none: "The file map gave this deliverable no lead story.",
      supporting: [],
      traits_shown: [],
      lenses: [],
      why: "Not in the file map.",
    }
  );
}

function angleFromRow(row: AngleRow, key: string): Angle {
  return {
    deliverable_key: key,
    label: row.label,
    pitch: row.pitch,
    opening_line: row.opening || row.pitch,
    stories: (row.stories ?? []).slice(0, 4),
    beats: (row.beats ?? []).map((b) => ({ beat: b.beat, words: b.words, sources: b.sources })),
    proves: (row.proves ?? []) as Angle["proves"],
    risks: row.tradeoffs ?? [],
    recommended: row.recommended,
    reason: row.reason ?? row.pitch,
  };
}

const codesOf = (paragraphs: readonly Paragraph[], prefix: string) => [
  ...new Set(
    paragraphs.flatMap((p) =>
      p.sentences.flatMap((s) => s.sources.filter((c) => c.startsWith(prefix))),
    ),
  ),
];

function counts(paragraphs: readonly Paragraph[]) {
  const text = paragraphs.map((p) => p.sentences.map((s) => s.text).join(" ")).join("\n\n");
  return {
    plainText: text,
    wordCount: count(text, "words"),
    charCountIncl: count(text, "chars_incl_spaces"),
    charCountExcl: count(text, "chars_excl_spaces"),
  };
}

/** Saves an AI draft as a new current version, with its NEED items and counts. */
async function saveDraft(
  deps: KitDeps,
  userId: string,
  deliverable: Deliverable,
  args: {
    paragraphs: Paragraph[];
    extra?: Record<string, unknown>;
    angleId?: string | null;
    note: string;
    storyCodes?: string[];
    needs?: {
      paragraph_id: string;
      after_sentence: number;
      question: string;
      approx_words: number;
    }[];
    parentDraftId?: string | null;
    /** False for an on-demand Option B or C: saved beside the current draft, not over it. */
    makeCurrent?: boolean;
  },
): Promise<DraftRow> {
  const makeCurrent = args.makeCurrent ?? true;
  const doc: DraftDoc = { paragraphs: args.paragraphs };
  const fidelity = args.paragraphs.length > 0 ? voiceFidelity(doc).score : null;
  const draft = await createDraftVersion(deps.db, userId, deliverable.id, {
    author: "ai",
    content: { paragraphs: args.paragraphs, ...args.extra },
    angleId: args.angleId ?? null,
    parentDraftId: args.parentDraftId ?? null,
    ...counts(args.paragraphs),
    voiceFidelity: fidelity,
    note: args.note,
    usedFactCodes: codesOf(args.paragraphs, "F"),
    usedStoryCodes: [...new Set([...codesOf(args.paragraphs, "S"), ...(args.storyCodes ?? [])])],
    makeCurrent,
  });
  if (!draft) throw new Error(`Could not save the draft for ${deliverable.packKey}`);
  const needs = args.needs ?? [];
  if (needs.length > 0)
    await createNeedItems(
      deps.db,
      userId,
      deliverable.id,
      needs.map((n) => ({
        draftId: draft.id,
        paragraphId: n.paragraph_id,
        afterSentence: n.after_sentence,
        question: n.question,
        approxWords: n.approx_words,
      })),
    );
  if (makeCurrent)
    await updateDeliverable(deps.db, userId, deliverable.id, {
      status: needs.length > 0 ? "needs_you" : "draft_ready",
    });
  return draft;
}

/* Stages ---------------------------------------------------------------------------------------- */

export interface ContextOutput {
  snapshotVersion: number;
  packVersion: number;
  stance: AiStance;
  deliverables: { id: string; key: string; type: string; mode: string }[];
}

/** Stage 1: the dossier snapshot, the published pack, and the deliverables with their modes. */
async function contextStage(deps: KitDeps, ref: KitRef, l: Loaded): Promise<ContextOutput> {
  const policy = await getVerifiedAiPolicy(deps.db, l.ctx.schoolCycleId);
  const stance: AiStance =
    (policy?.stance as AiStance | undefined) ??
    (l.pack.ai_policy?.verified_at ? (l.pack.ai_policy.stance as AiStance) : "unknown");
  const items = packDeliverables(l.pack, l.ctx.isReapplicant);
  const rows = await upsertDeliverables(
    deps.db,
    ref.userId,
    ref.kitId,
    items.map((item, order) => {
      const type = DELIVERABLE_TYPE_OF[item.kind];
      return {
        type,
        packKey: item.key,
        title: item.title,
        promptText: item.prompt,
        limitKind: item.rule?.kind ?? null,
        limitValue: item.rule?.value ?? null,
        parts: (item.parts ?? []).filter((p) => p.trim() !== "").map((part) => ({ part })),
        order,
        authorshipMode: authorshipFor(type, stance),
      };
    }),
  );
  if (!rows) throw new KitNotFoundError(`Kit ${ref.kitId} is not a full kit`);
  return {
    snapshotVersion: l.snapshot.version,
    packVersion: l.published.version,
    stance,
    deliverables: rows.map((d) => ({
      id: d.id,
      key: d.packKey,
      type: d.type,
      mode: d.authorshipMode,
    })),
  };
}

/** Stages 2–3: positioning and the file map, reused from the preview when the dossier is unchanged. */
async function positioningStage(deps: KitDeps, ref: KitRef, l: Loaded) {
  const kit = await getKit(deps.db, ref.userId, ref.kitId);
  const kept =
    kit?.dossierSnapshotVersion === l.snapshot.version &&
    Object.keys(kit.positioning ?? {}).length > 0 &&
    Object.keys(kit.fileMap ?? {}).length > 0;
  if (kept) return { reused: true };

  const items = packDeliverables(l.pack, l.ctx.isReapplicant);
  const cycle = await getCycleWithSchool(deps.db, l.ctx.schoolCycleId);
  const retrieval = cycle
    ? await retrieveForSchool(deps.db, {
        userId: ref.userId,
        schoolId: l.ctx.school.id,
        cycle: l.ctx.cycle,
        query: `Why ${l.ctx.school.name}: courses, clubs and recruiting`,
        limit: 6,
      })
    : { chunks: [], sources: [] };
  const output = await deps.ai.run(
    "kit.positioning_filemap",
    {
      school: l.ctx.school.name,
      cycle: l.pack.cycle,
      deliverables: items.map(({ key, kind, prompt, limit, required }) => ({
        key,
        kind,
        prompt,
        limit,
        required,
      })),
      is_reapplicant: l.ctx.isReapplicant,
      recommenders: [],
      retrieval: retrieval.chunks,
    },
    l.run,
  );
  await saveKitOutputs(deps.db, ref.userId, ref.kitId, {
    positioning: output.positioning as unknown as Record<string, unknown>,
    fileMap: {
      ...(output.file_map as unknown as Record<string, unknown>),
      retrieval: retrieval.sources,
    },
    dossierSnapshotVersion: l.snapshot.version,
    packVersion: l.published.version,
  });
  return { reused: false };
}

async function loadMap(deps: KitDeps, ref: KitRef) {
  const kit = await getKit(deps.db, ref.userId, ref.kitId);
  return {
    fileMap: storedFileMap(kit?.fileMap),
    positioning: (kit?.positioning ?? {}) as Partial<Positioning>,
  };
}

export async function deliverablesWithSource(deps: KitDeps, ref: KitRef, l: Loaded) {
  const rows = (await listDeliverables(deps.db, ref.userId, ref.kitId)) ?? [];
  const sources = new Map(packDeliverables(l.pack, l.ctx.isReapplicant).map((d) => [d.key, d]));
  return rows.map((row) => ({ row, source: sources.get(row.packKey) }));
}

/** Stage 4: what's missing. Blocking questions go to the gap plane; the rest wait in the drafts. */
async function gapsStage(deps: KitDeps, ref: KitRef, l: Loaded) {
  const { fileMap } = await loadMap(deps, ref);
  const drafted = (await deliverablesWithSource(deps, ref, l)).filter(
    ({ row }) => LONG_TYPES.has(row.type) || SHORT_TYPES.has(row.type),
  );
  if (drafted.length === 0) return { blocking: 0, open: 0 };
  const output = await deps.ai.run(
    "kit.gaps",
    {
      deliverables: drafted.map(({ row, source }) => writingDeliverable(row, source)),
      file_map: fileMap,
    },
    l.run,
  );
  await saveKitOutputs(deps.db, ref.userId, ref.kitId, { gaps: output.gaps });
  const byKey = new Map(drafted.map(({ row }) => [row.packKey, row]));
  const fallback = drafted[0]?.row;
  let blocking = 0;
  for (const gap of output.gaps) {
    const deliverable = byKey.get(gap.deliverable_key) ?? fallback;
    if (!deliverable) continue;
    if (gap.blocking) blocking += 1;
    await createNeedItems(deps.db, ref.userId, deliverable.id, [
      { question: gap.question, approxWords: gap.approx_words, blocking: gap.blocking },
    ]);
  }
  return { blocking, open: output.gaps.length };
}

/** Stage 5: 1–3 angles for every long essay, in one call. */
async function anglesStage(deps: KitDeps, ref: KitRef, l: Loaded) {
  const { fileMap, positioning } = await loadMap(deps, ref);
  const essays = (await deliverablesWithSource(deps, ref, l)).filter(({ row }) =>
    LONG_TYPES.has(row.type),
  );
  if (essays.length === 0) return { angles: 0 };
  const output = await deps.ai.run(
    "kit.angles",
    {
      essays: essays.slice(0, 8).map(({ row, source }) => writingDeliverable(row, source)),
      file_map: fileMap,
      lead_traits: (positioning.lead_traits ?? []).map((t) => t.trait).slice(0, 3),
    },
    l.run,
  );
  let saved = 0;
  for (const { row } of essays) {
    const mine = output.angles.filter((a) => a.deliverable_key === row.packKey);
    if (mine.length === 0) continue;
    await saveAngles(
      deps.db,
      ref.userId,
      row.id,
      mine.map((a) => ({
        label: a.label,
        pitch: a.pitch,
        opening: a.opening_line,
        stories: a.stories,
        beats: a.beats,
        proves: a.proves,
        tradeoffs: a.risks,
        recommended: a.recommended,
        reason: a.reason,
      })),
    );
    saved += mine.length;
  }
  return { angles: saved };
}

function otherDeliverables(map: FileMap, key: string) {
  return map.items
    .filter((item) => item.deliverable_key !== key)
    .slice(0, 40)
    .map((item) => ({
      key: item.deliverable_key,
      primary_story: item.primary_story,
      first_line: null,
      last_line: null,
    }));
}

/** Drafts one long essay on its recommended angle (or `angleId`). Exported for kit/draft-option. */
export async function draftEssay(
  deps: KitDeps,
  ref: KitRef,
  l: Loaded,
  row: Deliverable,
  source: PackDeliverable | undefined,
  options: {
    angleId?: string;
    escalate?: boolean;
    parentDraftId?: string | null;
    makeCurrent?: boolean;
  } = {},
): Promise<DraftRow> {
  const { fileMap } = await loadMap(deps, ref);
  const angles = await listAngles(deps.db, ref.userId, row.id);
  const angle =
    angles.find((a) => a.id === options.angleId) ?? angles.find((a) => a.recommended) ?? angles[0];
  if (!angle) throw new Error(`${row.title ?? row.packKey} has no angle to draft from`);
  const mode = row.authorshipMode === "coach" ? "coach" : "draft";
  const output = await deps.ai.run(
    "kit.draft",
    {
      mode,
      deliverable: writingDeliverable(row, source),
      angle: angleFromRow(angle, row.packKey),
      file_map_item: fileMapItem(fileMap, row.packKey),
      other_deliverables: otherDeliverables(fileMap, row.packKey),
      retrieval: [],
    },
    { ...l.run, ...(options.escalate ? { escalate: true } : {}) },
  );
  const storyCodes = [...(angle.stories ?? [])];
  if (mode === "coach") {
    const coach = output.coach as CoachBeats;
    return saveDraft(deps, ref.userId, row, {
      paragraphs: [],
      extra: { coach },
      angleId: angle.id,
      note: `Coaching for option ${angle.label}`,
      storyCodes,
      parentDraftId: options.parentDraftId ?? null,
      ...(options.makeCurrent === false ? { makeCurrent: false } : {}),
    });
  }
  const draft = output.draft as Draft;
  return saveDraft(deps, ref.userId, row, {
    paragraphs: draft.paragraphs,
    extra: {
      notes: draft.notes,
      prompt_parts_answered: draft.prompt_parts_answered,
      verify: draft.verify,
    },
    angleId: angle.id,
    note: options.escalate ? `Option ${angle.label}, rewritten` : `Option ${angle.label}`,
    storyCodes,
    needs: draft.needs,
    parentDraftId: options.parentDraftId ?? null,
    ...(options.makeCurrent === false ? { makeCurrent: false } : {}),
  });
}

export interface DraftsOutput {
  drafted: string[];
  failed: { id: string; title: string; error: string }[];
}

/** Stage 6: every long essay drafted in parallel; one failing never holds up the others. */
async function draftsStage(deps: KitDeps, ref: KitRef, l: Loaded): Promise<DraftsOutput> {
  const essays = (await deliverablesWithSource(deps, ref, l)).filter(
    ({ row }) => LONG_TYPES.has(row.type) && (!ref.only || ref.only.includes(row.id)),
  );
  const results = await Promise.all(
    essays.map(async ({ row, source }) => {
      await updateDeliverable(deps.db, ref.userId, row.id, { status: "drafting" });
      try {
        await draftEssay(deps, ref, l, row, source);
        return { ok: true as const, id: row.id };
      } catch (error) {
        await updateDeliverable(deps.db, ref.userId, row.id, { status: "pending" });
        return {
          ok: false as const,
          id: row.id,
          title: row.title ?? row.packKey,
          error: error instanceof Error ? error.message.slice(0, 300) : "unknown error",
        };
      }
    }),
  );
  return {
    drafted: results.filter((r) => r.ok).map((r) => r.id),
    failed: results.flatMap((r) => (r.ok ? [] : [{ id: r.id, title: r.title, error: r.error }])),
  };
}

/** Stage 7: short answers, goal fields and the video plan, in one call. */
async function shortFormStage(deps: KitDeps, ref: KitRef, l: Loaded) {
  const { fileMap } = await loadMap(deps, ref);
  const all = await deliverablesWithSource(deps, ref, l);
  const items = all.filter(
    ({ row }) => SHORT_TYPES.has(row.type) && (!ref.only || ref.only.includes(row.id)),
  );
  if (items.length === 0) return { drafted: 0 };
  // Lines already used in the long essays: no short item may repeat one (§5.9).
  const essayLines: string[] = [];
  for (const { row } of all.filter(({ row }) => LONG_TYPES.has(row.type))) {
    const current = await getCurrentDraft(deps.db, ref.userId, row.id);
    for (const p of current?.content.paragraphs ?? [])
      for (const s of p.sentences) if (s.kind !== "composed") essayLines.push(s.text);
  }
  const output = await deps.ai.run(
    "kit.shortform",
    {
      items: items.slice(0, 20).map(({ row, source }) => writingDeliverable(row, source)),
      file_map: fileMap,
      essay_lines: essayLines.slice(0, 80),
      retrieval: [],
    },
    l.run,
  );
  let drafted = 0;
  for (const { row } of items) {
    const item = output.items.find((i: ShortformItem) => i.deliverable_key === row.packKey);
    if (!item) continue;
    await saveDraft(deps, ref.userId, row, {
      paragraphs: item.paragraphs,
      extra: {
        format: item.format,
        list_tones: item.list_tones,
        video: item.video,
        why: item.why,
        ...(row.type === "goal_field" && output.goals_statement
          ? { goals_statement: output.goals_statement }
          : {}),
        verify: output.verify,
      },
      note: row.type === "video" ? "Talking points" : "First draft",
      needs: item.needs,
    });
    drafted += 1;
  }
  return { drafted };
}

function lintContext(row: Deliverable, cycle: string) {
  return { limit: ruleOf(row), currentCycle: cycle };
}

export function lint(doc: DraftDoc, row: Deliverable, cycle: string): LintFinding[] {
  const ctx = lintContext(row, cycle);
  return [...runLinters(doc, ctx), ...checkProvenance(doc, ctx).findings];
}

export function toCheck(
  source: "linter" | "critic",
  f: LintFinding & { patch?: unknown },
): NewCheck {
  return {
    source,
    ruleId: f.rule_id,
    severity: f.severity,
    location: { paragraph_id: f.location.paragraph_id, sentence: f.location.sentence },
    explanation: f.explanation,
    fixHint: f.fix_hint,
    ...(f.patch ? { patch: f.patch } : {}),
  };
}

/** Over the portal's limit: trims on the cheap route, at most twice (§5.7 stage 8, §8.6). */
async function autoFixLimit(
  deps: KitDeps,
  ref: KitRef,
  l: Loaded,
  row: Deliverable,
  draft: DraftRow,
): Promise<DraftRow> {
  const rule = ruleOf(row);
  let current = draft;
  for (let pass = 0; rule && pass < AUTO_FIX_PASSES; pass += 1) {
    const status = limitStatus(current.plainText, rule);
    if (status.over <= 0) break;
    const paragraphs = current.content.paragraphs as Paragraph[];
    const free = paragraphs
      .map((p) => p.id)
      .filter((id) => !current.lockedParagraphs.includes(id))
      .filter((id) => !current.userEditedParagraphs.includes(id));
    if (free.length === 0) break;
    const words = rule.kind === "words" ? status.over : Math.ceil(status.over / 5);
    const revision = await deps.ai.run(
      "draft.revise",
      {
        instruction: `Cut about ${words} words to fit the ${rule.value}-${rule.kind === "words" ? "word" : "character"} limit. Keep the story and the applicant's own lines.`,
        target_paragraph_ids: free,
        draft: { paragraphs },
        locked_paragraph_ids: current.lockedParagraphs,
        user_edited_paragraph_ids: current.userEditedParagraphs,
        limit: rule,
        cut: { words: Math.max(1, words), paragraph_ids: free },
      },
      l.run,
    );
    let n = paragraphs.length;
    const next = applyPatches(paragraphs, revision.patches, () => `p${(n += 1)}`);
    current = await saveDraft(deps, ref.userId, row, {
      paragraphs: next,
      extra: { ...current.content, paragraphs: undefined },
      angleId: current.angleId,
      note: "Trimmed to the limit",
      parentDraftId: current.id,
    });
  }
  return current;
}

/**
 * Stage 8: the linters, the Critic, mechanical fixes and the one escalation (§8.3) per drafted
 * deliverable. Coach-mode and talking-points deliverables have no prose to check.
 */
async function checksStage(deps: KitDeps, ref: KitRef, l: Loaded) {
  const { fileMap } = await loadMap(deps, ref);
  const all = await deliverablesWithSource(deps, ref, l);
  let checked = 0;
  const escalated: string[] = [];
  for (const { row, source } of all) {
    if (ref.only && !ref.only.includes(row.id)) continue;
    let draft = await getCurrentDraft(deps.db, ref.userId, row.id);
    if (!draft || draft.content.paragraphs.length === 0) continue;
    draft = await autoFixLimit(deps, ref, l, row, draft);

    const reports: { findings: LintFinding[]; scores: Record<string, number> }[] = [];
    let wasEscalated = false;
    let linterFindings: LintFinding[] = [];
    let criticFindings: LintFinding[] = [];
    for (let round = 0; round < 3; round += 1) {
      const doc: DraftDoc = { paragraphs: draft.content.paragraphs as Paragraph[] };
      linterFindings = lint(doc, row, l.ctx.cycle);
      const critic = await deps.ai.run(
        "kit.critic",
        {
          deliverable: writingDeliverable(row, source),
          draft: {
            paragraphs: doc.paragraphs as Paragraph[],
            needs: [],
            prompt_parts_answered: [],
            notes: { why_this_story: "—", what_it_proves: "—", school_fit_points: [] },
            verify: [],
            ...(draft.content as object),
          } as Draft,
          file_map_item: fileMapItem(fileMap, row.packKey),
          other_deliverables: otherDeliverables(fileMap, row.packKey),
          linter_findings: linterFindings.slice(0, 80).map((f) => ({
            rule_id: f.rule_id,
            severity: f.severity,
            location: f.location,
            explanation: f.explanation,
            fix_hint: f.fix_hint,
          })),
        },
        l.run,
      );
      criticFindings = critic.findings as LintFinding[];
      reports.push({ findings: criticFindings, scores: critic.scores });
      const decision = selectEscalation("kit.draft", {
        reports: reports as never,
        escalated: wasEscalated,
      });
      if (decision.action === "escalate" && LONG_TYPES.has(row.type)) {
        draft = await draftEssay(deps, ref, l, row, source, {
          ...(draft.angleId ? { angleId: draft.angleId } : {}),
          escalate: true,
          parentDraftId: draft.id,
        });
        wasEscalated = true;
        escalated.push(row.id);
        continue;
      }
      // §8.3: one failure redrafts on the normal route and critiques again; a second escalates.
      if (decision.action === "retry" && round === 0 && LONG_TYPES.has(row.type)) {
        draft = await draftEssay(deps, ref, l, row, source, {
          ...(draft.angleId ? { angleId: draft.angleId } : {}),
          parentDraftId: draft.id,
        });
        continue;
      }
      break;
    }
    await replaceChecks(deps.db, ref.userId, draft.id, [
      ...linterFindings.map((f) => toCheck("linter", f)),
      ...criticFindings.map((f) => toCheck("critic", f)),
    ]);
    checked += 1;
  }
  return { checked, escalated };
}

/** Stage 10: one Verify list for the whole kit, from every draft's own list and its provenance. */
async function verifyStage(deps: KitDeps, ref: KitRef, l: Loaded) {
  const all = await deliverablesWithSource(deps, ref, l);
  const items: { deliverableId: string; draftId: string; text: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const { row } of all) {
    if (ref.only && !ref.only.includes(row.id)) continue;
    const draft = await getCurrentDraft(deps.db, ref.userId, row.id);
    if (!draft) continue;
    const own = (draft.content.verify ?? []) as { text: string; reason: string }[];
    const doc: DraftDoc = { paragraphs: draft.content.paragraphs as Paragraph[] };
    const fromProvenance = checkProvenance(doc, lintContext(row, l.ctx.cycle)).verify.map((v) => ({
      text: v.text,
      reason: v.reason,
    }));
    for (const v of [...own, ...fromProvenance]) {
      const key = `${row.id}:${v.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        deliverableId: row.id,
        draftId: draft.id,
        text: v.text.slice(0, 1000),
        reason: v.reason.slice(0, 500),
      });
    }
  }
  if (items.length > 0) await addVerifyItems(deps.db, ref.userId, ref.kitId, items);
  return { verify: items.length };
}

export interface FormsStageOutput {
  /** `failed` keeps the kit going; the form view asks again when it's opened. */
  forms: { sections: number; mode: "draft" | "coach" } | "failed";
  /** "reviewed" now, "kept" an earlier review, "none" without a résumé, "failed" (kit continues). */
  resume: "reviewed" | "kept" | "none" | "failed";
  /** Phases 6 and 7 add recommender briefs and the interview plan here. */
  later: ["recommenders", "interview_plan"];
}

/**
 * Stage 9 (§5.7): the Form Advisor for this school, and the Résumé Pass when a résumé has been
 * uploaded and not reviewed yet. Neither failing fails the kit, whose essays are ready by now: the
 * form view and the Résumé page each ask again when opened.
 */
async function formsStage(deps: KitDeps, ref: KitRef, l: Loaded): Promise<FormsStageOutput> {
  let forms: FormsStageOutput["forms"];
  try {
    const advised = await adviseForms(deps, ref, l);
    forms = { sections: advised.sections, mode: advised.mode };
  } catch (error) {
    if (error instanceof KitNotFoundError) throw error;
    console.error("[kit] form advisor failed", error);
    forms = "failed";
  }
  let resume: FormsStageOutput["resume"];
  try {
    const result = await reviewLatestResume(deps.ai, ref.userId, { db: deps.db });
    resume = !result ? "none" : result.fresh ? "reviewed" : "kept";
  } catch (error) {
    console.error("[kit] résumé pass failed", error);
    resume = "failed";
  }
  return {
    forms,
    resume,
    later: ["recommenders", "interview_plan"],
  };
}

/* Driver ---------------------------------------------------------------------------------------- */

/** Runs one stage by key. The Inngest function calls this once per step. */
export async function runStage(deps: KitDeps, ref: KitRef, key: KitStageKey): Promise<unknown> {
  const l = await load(deps, ref);
  const rerun =
    ref.only !== undefined && ["drafts", "short_form", "checks", "verify"].includes(key);
  switch (key) {
    case "context":
      return stage(deps, ref, key, () => contextStage(deps, ref, l));
    case "positioning":
      return stage(deps, ref, key, () => positioningStage(deps, ref, l));
    case "file_map":
      return stage(deps, ref, key, async () => {
        const { fileMap } = await loadMap(deps, ref);
        return { items: fileMap.items.length, warnings: fileMap.warnings };
      });
    case "gaps":
      return stage(deps, ref, key, () => gapsStage(deps, ref, l));
    case "angles":
      return stage(deps, ref, key, () => anglesStage(deps, ref, l));
    case "drafts":
      return stage(deps, ref, key, () => draftsStage(deps, ref, l), { rerun });
    case "short_form":
      return stage(deps, ref, key, () => shortFormStage(deps, ref, l), { rerun });
    case "checks":
      return stage(deps, ref, key, () => checksStage(deps, ref, l), { rerun });
    case "forms":
      return stage(deps, ref, key, () => formsStage(deps, ref, l));
    case "verify":
      return stage(deps, ref, key, () => verifyStage(deps, ref, l), { rerun });
  }
}

/** Marks the kit ready (or failed when nothing was drafted), with the failed essays named. */
export async function finishKit(deps: KitDeps, ref: KitRef): Promise<{ status: string }> {
  const stages = await listKitStages(deps.db, ref.userId, ref.kitId);
  const drafts = stages.find((s) => s.stage === "drafts")?.output as DraftsOutput | undefined;
  const failed = drafts?.failed ?? [];
  const nothing = (drafts?.drafted.length ?? 0) === 0 && failed.length > 0;
  const error =
    failed.length === 0 ? null : `${failed.map((f) => f.title).join(", ")} didn't finish drafting.`;
  await setKitStatus(deps.db, ref.userId, ref.kitId, nothing ? "failed" : "ready", { error });
  return { status: nothing ? "failed" : "ready" };
}

/** The whole pipeline in one process (no Inngest): stages in order, resuming finished ones. */
export async function runPipeline(deps: KitDeps, ref: KitRef): Promise<{ status: string }> {
  await setKitStatus(deps.db, ref.userId, ref.kitId, "running");
  try {
    for (const key of STAGE_ORDER) await runStage(deps, ref, key);
  } catch (error) {
    if (error instanceof KitNotFoundError) throw error;
    await setKitStatus(deps.db, ref.userId, ref.kitId, "failed", {
      error: "Your kit stopped partway. Try again and it picks up where it stopped.",
    });
    throw error;
  }
  return finishKit(deps, ref);
}
