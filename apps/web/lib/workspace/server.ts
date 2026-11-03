import "server-only";

import { applyPatches, patchGuardIssues } from "@admitstory/ai";
import {
  consumeEntitlement,
  createDraftVersion,
  createGoldenLines,
  getDb,
  getDeliverable,
  getDraft,
  getKitContext,
  getVerifiedAiPolicy,
  hasEntitlement,
  listChecks,
  listNeedItems,
  releaseEntitlement,
  replaceChecks,
  type CheckRow,
  type Deliverable,
  type DraftRow,
  type KitContext,
} from "@admitstory/db";
import {
  limitStatus,
  runAffectedLinters,
  type DraftDoc,
  type Finding as LintFinding,
} from "@admitstory/linters";
import type { Paragraph } from "@admitstory/shared/kit";
import { ApiError } from "@/lib/api";
import { ai } from "@/lib/ai";
import { ruleOf, toCheck } from "@/lib/kit/pipeline";
import { answerNeed } from "@/lib/kit/needs";
import { ensureSnapshot } from "@/lib/strategy/jobs";
import { latestPack } from "@/lib/strategy/server";

// The Workspace's server side (spec §5.8, §8.6): every route here is ownership-checked through
// user → kit → deliverable → draft, and entitlement-checked against the school the kit is for. A
// refund revokes the entitlement, and with it access to the kit's drafts (§13).

export interface DraftContext {
  draft: DraftRow;
  deliverable: Deliverable;
  kit: KitContext;
}

/** Throws 403 when the kit's entitlement is gone (refunded) or never existed. */
export async function requireKitAccess(userId: string, kit: KitContext): Promise<void> {
  if (!(await hasEntitlement(getDb(), userId, "school_kit", kit.schoolCycleId)))
    throw new ApiError(403, `Your access to the ${kit.school.name} kit has ended.`);
}

export async function deliverableContext(
  userId: string,
  deliverableId: string,
): Promise<{ deliverable: Deliverable; kit: KitContext }> {
  const db = getDb();
  const deliverable = await getDeliverable(db, userId, deliverableId);
  if (!deliverable) throw new ApiError(404, "That deliverable could not be found.");
  const kit = await getKitContext(db, userId, deliverable.kitId);
  if (!kit) throw new ApiError(404, "That deliverable could not be found.");
  await requireKitAccess(userId, kit);
  return { deliverable, kit };
}

export async function draftContext(userId: string, draftId: string): Promise<DraftContext> {
  const draft = await getDraft(getDb(), userId, draftId);
  if (!draft) throw new ApiError(404, "That draft could not be found.");
  const { deliverable, kit } = await deliverableContext(userId, draft.deliverableId);
  return { draft, deliverable, kit };
}

function runFor(userId: string, kit: KitContext, pack: { id: string; compiledPrompt: string }) {
  return { userId, kitId: kit.kit.id, schoolPack: pack.compiledPrompt, schoolPackId: pack.id };
}

async function packFor(kit: KitContext) {
  const pack = await latestPack(getDb(), kit.schoolCycleId);
  if (!pack) throw new ApiError(409, `${kit.school.name}'s pack isn't published.`);
  return pack;
}

const textOf = (paragraphs: readonly Paragraph[]) =>
  paragraphs.map((p) => p.sentences.map((s) => s.text).join(" ")).join("\n\n");

function lintCtx(deliverable: Deliverable, kit: KitContext) {
  return { limit: ruleOf(deliverable), currentCycle: kit.cycle };
}

const asFinding = (row: CheckRow): LintFinding =>
  ({
    rule_id: row.ruleId,
    severity: row.severity,
    location: row.location,
    explanation: row.explanation,
    fix_hint: row.fixHint,
  }) as LintFinding;

/**
 * Carries the checks to a new version after a change to some paragraphs (§8.6): the affected
 * linters run again; the Critic's findings on untouched paragraphs carry over.
 */
async function carryChecks(
  userId: string,
  from: DraftRow,
  to: DraftRow,
  changed: readonly string[],
  deliverable: Deliverable,
  kit: KitContext,
): Promise<void> {
  const db = getDb();
  const previous = await listChecks(db, userId, from.id);
  const doc: DraftDoc = { paragraphs: to.content.paragraphs as Paragraph[] };
  const linter = runAffectedLinters(
    changed,
    doc,
    lintCtx(deliverable, kit),
    previous.filter((c) => c.source === "linter").map(asFinding),
  );
  const critic = previous.filter(
    (c) => c.source === "critic" && !changed.includes(c.location.paragraph_id ?? ""),
  );
  await replaceChecks(db, userId, to.id, [
    ...linter.map((f) => toCheck("linter", f)),
    ...critic.map((c) => toCheck("critic", asFinding(c))),
  ]);
}

async function saveVersion(
  userId: string,
  ctx: DraftContext,
  paragraphs: Paragraph[],
  args: { author: "ai" | "user"; note: string; userEdited?: string[] },
): Promise<DraftRow> {
  const text = textOf(paragraphs);
  const draft = await createDraftVersion(getDb(), userId, ctx.deliverable.id, {
    author: args.author,
    content: { ...ctx.draft.content, paragraphs },
    angleId: ctx.draft.angleId,
    parentDraftId: ctx.draft.id,
    plainText: text,
    note: args.note,
    lockedParagraphs: ctx.draft.lockedParagraphs.filter((id) =>
      paragraphs.some((p) => p.id === id),
    ),
    userEditedParagraphs: args.userEdited ?? ctx.draft.userEditedParagraphs,
    usedFactCodes: ctx.draft.usedFactCodes,
    usedStoryCodes: ctx.draft.usedStoryCodes,
  });
  if (!draft) throw new ApiError(404, "That draft could not be found.");
  return draft;
}

/* Refine (§5.8, §8.6) -------------------------------------------------------------------------- */

export interface RefineResult {
  draft: DraftRow;
  changed: string[];
  summary: string;
  /** Still over the limit after two cuts: "N words over". */
  over: number;
}

/** The limit loop (§8.6): at most this many cut passes after a revision. */
const LIMIT_LOOP_MAX = 2;

export async function refineDraft(
  userId: string,
  ctx: DraftContext,
  request: { instruction: string; paragraphIds?: string[] },
): Promise<RefineResult> {
  const db = getDb();
  const paragraphs = ctx.draft.content.paragraphs as Paragraph[];
  if (paragraphs.length === 0)
    throw new ApiError(409, "This one is yours to write. Use the coaching beats beside it.");
  const locked = ctx.draft.lockedParagraphs;
  const edited = ctx.draft.userEditedParagraphs;
  const pack = await packFor(ctx.kit);
  const run = runFor(userId, ctx.kit, pack);

  let targets = request.paragraphIds ?? [];
  if (targets.length === 0) {
    const picked = await ai().run(
      "util.classify",
      {
        instruction: request.instruction,
        paragraphs: paragraphs.map((p) => ({
          id: p.id,
          text: p.sentences
            .map((s) => s.text)
            .join(" ")
            .slice(0, 6_000),
          locked: locked.includes(p.id),
        })),
      },
      run,
    );
    targets =
      picked.whole_draft || picked.paragraph_ids.length === 0
        ? paragraphs.map((p) => p.id)
        : picked.paragraph_ids;
  }
  const free = targets.filter((id) => !locked.includes(id) && !edited.includes(id));
  if (free.length === 0)
    throw new ApiError(
      409,
      "Those paragraphs are locked or hold your own edits, so we won't rewrite them. Unlock one or ask about another paragraph.",
    );

  const used = await consumeEntitlement(db, userId, {
    refId: ctx.kit.schoolCycleId,
    counter: "revisions",
  });
  if (!used.ok)
    throw new ApiError(
      402,
      used.reason === "limit_reached"
        ? `You've used all ${used.limit} refinements for this kit.`
        : `Your access to the ${ctx.kit.school.name} kit has ended.`,
    );

  const rule = ruleOf(ctx.deliverable);
  const base = {
    draft: { paragraphs },
    locked_paragraph_ids: locked,
    user_edited_paragraph_ids: edited,
    limit: rule,
  };
  const rules = {
    paragraphIds: paragraphs.map((p) => p.id),
    targets: free,
    locked,
    userEdited: edited,
  };
  let revision: Awaited<ReturnType<typeof reviseOnce>>;
  async function reviseOnce() {
    return ai().run(
      "draft.revise",
      { ...base, instruction: request.instruction, target_paragraph_ids: free },
      run,
    );
  }
  try {
    revision = await reviseOnce();
    if (patchGuardIssues(revision.patches, rules).length > 0)
      throw new ApiError(422, "That change touched a paragraph it shouldn't. Nothing was changed.");
  } catch (error) {
    // Nothing changed, so the refinement isn't spent.
    await releaseEntitlement(db, userId, { refId: ctx.kit.schoolCycleId, counter: "revisions" });
    throw error;
  }
  let n = paragraphs.length;
  const newId = () => `p${(n += 1)}`;
  let next = applyPatches(paragraphs, revision.patches, newId);

  // The limit loop: cut from the paragraphs just changed, at most twice.
  let over = rule ? limitStatus(textOf(next), rule).over : 0;
  for (let pass = 0; rule && over > 0 && pass < LIMIT_LOOP_MAX; pass += 1) {
    const ids = free.filter((id) => next.some((p) => p.id === id));
    if (ids.length === 0) break;
    const words = rule.kind === "words" ? over : Math.ceil(over / 5);
    const cut = await ai().run(
      "draft.revise",
      {
        ...base,
        draft: { paragraphs: next },
        instruction: `Cut about ${words} words to fit the limit.`,
        target_paragraph_ids: ids,
        cut: { words: Math.max(1, words), paragraph_ids: ids },
      },
      run,
    );
    if (
      patchGuardIssues(cut.patches, { ...rules, paragraphIds: next.map((p) => p.id), targets: ids })
        .length > 0
    )
      break;
    next = applyPatches(next, cut.patches, newId);
    over = limitStatus(textOf(next), rule).over;
  }

  const before = new Map(paragraphs.map((p) => [p.id, JSON.stringify(p.sentences)]));
  const changed = next
    .filter((p) => before.get(p.id) !== JSON.stringify(p.sentences))
    .map((p) => p.id)
    .concat(paragraphs.filter((p) => !next.some((q) => q.id === p.id)).map((p) => p.id));
  const draft = await saveVersion(userId, ctx, next, {
    author: "ai",
    note: revision.summary.slice(0, 300),
  });
  await carryChecks(userId, ctx.draft, draft, changed, ctx.deliverable, ctx.kit);
  return { draft, changed, summary: revision.summary, over };
}

/* Save, restore -------------------------------------------------------------------------------- */

/**
 * The applicant's own edits (§5.8): a new version authored by the user. Edited paragraphs join
 * `user_edited_paragraphs`, which the AI then never overwrites; untouched sentences keep their
 * provenance, as DocCanvas serialises them.
 */
export async function saveUserEdits(
  userId: string,
  ctx: DraftContext,
  paragraphs: Paragraph[],
  lockedParagraphs?: string[],
): Promise<{ draft: DraftRow; changed: string[] }> {
  const previous = new Map(
    (ctx.draft.content.paragraphs as Paragraph[]).map((p) => [p.id, JSON.stringify(p.sentences)]),
  );
  const changed = paragraphs
    .filter((p) => previous.get(p.id) !== JSON.stringify(p.sentences))
    .map((p) => p.id);
  const userEdited = [...new Set([...ctx.draft.userEditedParagraphs, ...changed])].filter((id) =>
    paragraphs.some((p) => p.id === id),
  );
  const draft = await saveVersion(
    userId,
    lockedParagraphs ? { ...ctx, draft: { ...ctx.draft, lockedParagraphs } } : ctx,
    paragraphs,
    { author: "user", note: "Your edits", userEdited },
  );
  await carryChecks(userId, ctx.draft, draft, changed, ctx.deliverable, ctx.kit);
  return { draft, changed };
}

/* NEED answers (§5.8) -------------------------------------------------------------------------- */

/**
 * Saves the answer to the dossier (a `need_answer` source and the applicant's own line), then
 * regenerates only the paragraph the NEED chip sits in. Locked or hand-edited paragraphs keep the
 * answer in the dossier and are left for the applicant to use.
 */
export async function answerNeedAndFill(
  userId: string,
  needId: string,
  text: string,
  via: "voice" | "text",
): Promise<{ draft: DraftRow | null }> {
  const db = getDb();
  const need = (await listNeedItems(db, userId, {})).find((n) => n.id === needId);
  if (!need) throw new ApiError(404, "That question could not be found.");
  const { deliverable, kit } = await deliverableContext(userId, need.deliverableId);
  const saved = await answerNeed(userId, needId, text, { via, question: need.question });
  if (!saved) throw new ApiError(404, "That question could not be found.");
  const [line] = await createGoldenLines(db, userId, [
    { text: text.slice(0, 2000), sourceId: saved.sourceId },
  ]);
  if (!need.draftId || !need.paragraphId || !line) return { draft: null };

  const draft = await getDraft(db, userId, need.draftId);
  if (!draft || !draft.isCurrent) return { draft: null };
  const ctx: DraftContext = { draft, deliverable, kit };
  const paragraphs = draft.content.paragraphs as Paragraph[];
  const at = paragraphs.findIndex((p) => p.id === need.paragraphId);
  const paragraph = paragraphs[at];
  if (
    !paragraph ||
    draft.lockedParagraphs.includes(paragraph.id) ||
    draft.userEditedParagraphs.includes(paragraph.id)
  )
    return { draft: null };

  const pack = await packFor(kit);
  const snapshot = await ensureSnapshot(userId);
  const rule = ruleOf(deliverable);
  const [before, after] = [paragraphs[at - 1], paragraphs[at + 1]];
  const output = await ai().run(
    "draft.need_fill",
    {
      paragraph,
      before: before ? textOf([before]) : null,
      after: after ? textOf([after]) : null,
      need: { question: need.question, approx_words: need.approxWords ?? 20 },
      answer: { text, code: line.code },
      limit_words: rule?.kind === "words" ? rule.value : null,
    },
    { ...runFor(userId, kit, pack), dossier: snapshot.compactText },
  );
  const next = paragraphs.map((p, i) => (i === at ? { ...output.paragraph, id: p.id } : p));
  const saved2 = await saveVersion(userId, ctx, next, {
    author: "ai",
    note: output.summary.slice(0, 300),
  });
  await carryChecks(userId, draft, saved2, [paragraph.id], deliverable, kit);
  return { draft: saved2 };
}

/* Authorship ----------------------------------------------------------------------------------- */

export async function policyFor(kit: KitContext) {
  const policy = await getVerifiedAiPolicy(getDb(), kit.schoolCycleId);
  return policy
    ? {
        stance: policy.stance,
        url: policy.sourceUrl,
        verifiedAt: policy.verifiedAt?.toISOString().slice(0, 10) ?? null,
        disclosure: policy.disclosureText,
      }
    : null;
}
