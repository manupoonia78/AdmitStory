// The Workspace (spec §5.8, §8.6, §8.7): deliverables, angles, draft versions, checks, NEED items,
// the Verify list, revision requests and feedback. Ownership runs user → kit → deliverable → draft:
// a child row is only ever created under a parent the caller owns, and copies the parent's user_id,
// so every later statement is scoped by `user_id` and a forged id finds nothing.
//
// Draft history is append-only: every AI generation, user save and restore is a new version with
// `parent_draft_id` pointing at the version it came from; exactly one version per deliverable is
// current (a partial unique index enforces it).

import { SENTENCE_KINDS } from "@admitstory/shared/kit";
import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import {
  angleLabels,
  angles,
  authorshipModes,
  checkSeverities,
  checkSources,
  checkStatuses,
  checks,
  deliverableStatuses,
  deliverableTypes,
  deliverables,
  draftAuthors,
  drafts,
  feedback,
  kits,
  limitKinds,
  needItems,
  needStatuses,
  revisionRequests,
  revisionStatuses,
  sources,
  verifyItems,
  verifyStatuses,
  type CheckLocation,
  type CheckSource,
  type DraftContent,
} from "../schema";
import { assertId } from "./ids";

export type Deliverable = typeof deliverables.$inferSelect;
export type AngleRow = typeof angles.$inferSelect;
export type DraftRow = typeof drafts.$inferSelect;
export type CheckRow = typeof checks.$inferSelect;
export type NeedItem = typeof needItems.$inferSelect;
export type VerifyItem = typeof verifyItems.$inferSelect;
export type RevisionRequest = typeof revisionRequests.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;

const Text = z.string().trim().min(1);
const Code = z.string().trim().min(1).max(20);
const ParagraphId = z.string().trim().min(1).max(100);

/* Ownership ---------------------------------------------------------------------------------- */

async function ownedKit(db: DbExecutor, userId: string, kitId: string) {
  const [row] = await db
    .select({ id: kits.id })
    .from(kits)
    .where(
      and(
        eq(kits.userId, userId),
        eq(kits.id, assertId(kitId, "kitId")),
        ne(kits.status, "preview"),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function ownedDeliverable(db: DbExecutor, userId: string, deliverableId: string) {
  const [row] = await db
    .select({ id: deliverables.id, kitId: deliverables.kitId })
    .from(deliverables)
    .where(
      and(
        eq(deliverables.userId, userId),
        eq(deliverables.id, assertId(deliverableId, "deliverableId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function ownedDraft(db: DbExecutor, userId: string, draftId: string) {
  const [row] = await db
    .select({ id: drafts.id, deliverableId: drafts.deliverableId })
    .from(drafts)
    .where(and(eq(drafts.userId, userId), eq(drafts.id, assertId(draftId, "draftId"))))
    .limit(1);
  return row ?? null;
}

/* Deliverables ------------------------------------------------------------------------------- */

export const NewDeliverable = z.strictObject({
  type: z.enum(deliverableTypes),
  packKey: Text.max(200),
  title: z.string().trim().max(300).nullable().optional(),
  promptText: Text,
  limitKind: z.enum(limitKinds).nullable().optional(),
  limitValue: z.int().positive().nullable().optional(),
  parts: z.array(z.strictObject({ part: Text })).optional(),
  order: z.int().nonnegative().optional(),
  authorshipMode: z.enum(authorshipModes).optional(),
});
export type NewDeliverable = z.input<typeof NewDeliverable>;

/**
 * Creates the kit's deliverables from the pack, or refreshes them on a re-run (matched on
 * `pack_key`, so a resumed or regenerated pipeline never duplicates them). Status is left alone on
 * refresh. Null when the kit is not the caller's full kit.
 */
export async function upsertDeliverables(
  db: DbExecutor,
  userId: string,
  kitId: string,
  items: NewDeliverable[],
): Promise<Deliverable[] | null> {
  const ownerId = assertId(userId, "userId");
  const kit = await ownedKit(db, ownerId, kitId);
  if (!kit) return null;
  const values = z.array(NewDeliverable).parse(items);
  if (values.length === 0) return [];
  return db
    .insert(deliverables)
    .values(
      values.map((v, i) => ({
        userId: ownerId,
        kitId: kit.id,
        type: v.type,
        packKey: v.packKey,
        title: v.title ?? null,
        promptText: v.promptText,
        limitKind: v.limitKind ?? null,
        limitValue: v.limitValue ?? null,
        parts: v.parts ?? [],
        order: v.order ?? i,
        authorshipMode: v.authorshipMode ?? "draft",
      })),
    )
    .onConflictDoUpdate({
      target: [deliverables.kitId, deliverables.packKey],
      set: {
        type: sql`excluded.type`,
        title: sql`excluded.title`,
        promptText: sql`excluded.prompt_text`,
        limitKind: sql`excluded.limit_kind`,
        limitValue: sql`excluded.limit_value`,
        parts: sql`excluded.parts`,
        order: sql`excluded."order"`,
        authorshipMode: sql`excluded.authorship_mode`,
        updatedAt: new Date(),
      },
    })
    .returning();
}

export async function listDeliverables(
  db: DbExecutor,
  userId: string,
  kitId: string,
): Promise<Deliverable[]> {
  return db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.userId, assertId(userId, "userId")),
        eq(deliverables.kitId, assertId(kitId, "kitId")),
      ),
    )
    .orderBy(asc(deliverables.order), asc(deliverables.createdAt));
}

export async function getDeliverable(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
): Promise<Deliverable | null> {
  const [row] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.userId, assertId(userId, "userId")),
        eq(deliverables.id, assertId(deliverableId, "deliverableId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const DeliverablePatch = z
  .strictObject({
    status: z.enum(deliverableStatuses),
    /** The app enforces "only stricter than the school's policy" (§14.2) before calling this. */
    authorshipMode: z.enum(authorshipModes),
  })
  .partial();
export type DeliverablePatch = z.input<typeof DeliverablePatch>;

export async function updateDeliverable(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
  patch: DeliverablePatch,
): Promise<Deliverable | null> {
  const values = DeliverablePatch.parse(patch);
  if (Object.keys(values).length === 0) return getDeliverable(db, userId, deliverableId);
  const [row] = await db
    .update(deliverables)
    .set(values)
    .where(
      and(
        eq(deliverables.userId, assertId(userId, "userId")),
        eq(deliverables.id, assertId(deliverableId, "deliverableId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Angles ------------------------------------------------------------------------------------- */

export const NewAngle = z.strictObject({
  label: z.enum(angleLabels),
  pitch: Text,
  opening: z.string().trim(),
  stories: z.array(Code).optional(),
  beats: z
    .array(z.strictObject({ beat: Text, words: z.number().nonnegative(), sources: z.array(Code) }))
    .optional(),
  proves: z.array(z.string().trim().min(1)).optional(),
  tradeoffs: z.array(z.string().trim().min(1)).optional(),
  recommended: z.boolean().optional(),
  reason: z.string().trim().optional(),
});
export type NewAngle = z.input<typeof NewAngle>;

/** Saves the Angle Maker's options for a deliverable, replacing earlier ones with the same label. */
export async function saveAngles(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
  items: NewAngle[],
): Promise<AngleRow[] | null> {
  const ownerId = assertId(userId, "userId");
  const parent = await ownedDeliverable(db, ownerId, deliverableId);
  if (!parent) return null;
  const values = z.array(NewAngle).parse(items);
  if (values.length === 0) return [];
  return db
    .insert(angles)
    .values(
      values.map((v) => ({
        userId: ownerId,
        deliverableId: parent.id,
        label: v.label,
        pitch: v.pitch,
        opening: v.opening,
        stories: v.stories ?? [],
        beats: v.beats ?? [],
        proves: v.proves ?? [],
        tradeoffs: v.tradeoffs ?? [],
        recommended: v.recommended ?? false,
        reason: v.reason ?? "",
      })),
    )
    .onConflictDoUpdate({
      target: [angles.deliverableId, angles.label],
      set: {
        pitch: sql`excluded.pitch`,
        opening: sql`excluded.opening`,
        stories: sql`excluded.stories`,
        beats: sql`excluded.beats`,
        proves: sql`excluded.proves`,
        tradeoffs: sql`excluded.tradeoffs`,
        recommended: sql`excluded.recommended`,
        reason: sql`excluded.reason`,
        updatedAt: new Date(),
      },
    })
    .returning();
}

export async function listAngles(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
): Promise<AngleRow[]> {
  return db
    .select()
    .from(angles)
    .where(
      and(
        eq(angles.userId, assertId(userId, "userId")),
        eq(angles.deliverableId, assertId(deliverableId, "deliverableId")),
      ),
    )
    .orderBy(asc(angles.label));
}

/* Drafts ------------------------------------------------------------------------------------- */

const SentenceSchema = z.object({
  text: z.string(),
  kind: z.enum(SENTENCE_KINDS),
  sources: z.array(z.string()),
});
const ContentSchema = z.looseObject({
  paragraphs: z.array(z.object({ id: ParagraphId, sentences: z.array(SentenceSchema) })),
});

export const NewDraftVersion = z.strictObject({
  author: z.enum(draftAuthors),
  content: ContentSchema,
  angleId: z.guid().nullable().optional(),
  /** Defaults to the current version. */
  parentDraftId: z.guid().nullable().optional(),
  /** Pass the portal-exact text and counts from packages/linters; defaults are computed simply. */
  plainText: z.string().optional(),
  wordCount: z.int().nonnegative().optional(),
  charCountIncl: z.int().nonnegative().optional(),
  charCountExcl: z.int().nonnegative().optional(),
  voiceFidelity: z.number().min(0).max(1).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  /** Default to the parent's, kept to paragraphs that still exist. */
  lockedParagraphs: z.array(ParagraphId).optional(),
  userEditedParagraphs: z.array(ParagraphId).optional(),
  /** Default to the F## and S## codes the sentences cite. */
  usedFactCodes: z.array(Code).optional(),
  usedStoryCodes: z.array(Code).optional(),
  /** False drafts an alternative without replacing the version on screen. */
  makeCurrent: z.boolean().optional(),
});
export type NewDraftVersion = z.input<typeof NewDraftVersion>;

/** Paragraphs joined by blank lines, sentences by spaces. */
export function draftPlainText(content: Pick<DraftContent, "paragraphs">): string {
  return content.paragraphs
    .map((p) =>
      p.sentences
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n\n");
}

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function simpleCounts(text: string) {
  const graphemes = [...segmenter.segment(text)].map((s) => s.segment);
  return {
    wordCount: text.split(/\s+/).filter(Boolean).length,
    charCountIncl: graphemes.length,
    charCountExcl: graphemes.filter((g) => !/^\s+$/.test(g)).length,
  };
}

function citedCodes(content: Pick<DraftContent, "paragraphs">, prefix: "F" | "S"): string[] {
  const pattern = new RegExp(`^${prefix}\\d+$`);
  const codes = new Set<string>();
  for (const p of content.paragraphs)
    for (const s of p.sentences)
      for (const code of s.sources) if (pattern.test(code)) codes.add(code);
  return [...codes].sort();
}

/**
 * Adds a version to a deliverable (§5.8 version timeline). It becomes current unless
 * `makeCurrent: false`; its parent defaults to the current version, and locks and user-edit marks
 * carry over from the parent. Null when the deliverable, angle or parent is not the caller's.
 */
export async function createDraftVersion(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
  input: NewDraftVersion,
): Promise<DraftRow | null> {
  const ownerId = assertId(userId, "userId");
  const id = assertId(deliverableId, "deliverableId");
  const v = NewDraftVersion.parse(input);
  return db.transaction(async (tx) => {
    // Locking the deliverable serialises version numbers and the current flag.
    const [parentDeliverable] = await tx
      .select({ id: deliverables.id })
      .from(deliverables)
      .where(and(eq(deliverables.userId, ownerId), eq(deliverables.id, id)))
      .limit(1)
      .for("update");
    if (!parentDeliverable) return null;
    if (v.angleId) {
      const [angle] = await tx
        .select({ id: angles.id })
        .from(angles)
        .where(
          and(eq(angles.userId, ownerId), eq(angles.id, v.angleId), eq(angles.deliverableId, id)),
        )
        .limit(1);
      if (!angle) return null;
    }
    const [parent] = await tx
      .select()
      .from(drafts)
      .where(
        and(
          eq(drafts.userId, ownerId),
          eq(drafts.deliverableId, id),
          v.parentDraftId ? eq(drafts.id, v.parentDraftId) : eq(drafts.isCurrent, true),
        ),
      )
      .limit(1);
    if (v.parentDraftId && !parent) return null;

    const content = v.content as DraftContent;
    const plainText = v.plainText ?? draftPlainText(content);
    const counts = simpleCounts(plainText);
    const ids = new Set(content.paragraphs.map((p) => p.id));
    const keep = (list: string[]) => list.filter((p) => ids.has(p));
    const makeCurrent = v.makeCurrent ?? true;
    if (makeCurrent)
      await tx
        .update(drafts)
        .set({ isCurrent: false })
        .where(and(eq(drafts.deliverableId, id), eq(drafts.isCurrent, true)));
    const [row] = await tx
      .insert(drafts)
      .values({
        userId: ownerId,
        deliverableId: id,
        angleId: v.angleId ?? (v.angleId === null ? null : (parent?.angleId ?? null)),
        version: sql`(select coalesce(max(${drafts.version}), 0) + 1 from ${drafts} where ${drafts.deliverableId} = ${id})`,
        author: v.author,
        content,
        plainText,
        wordCount: v.wordCount ?? counts.wordCount,
        charCountIncl: v.charCountIncl ?? counts.charCountIncl,
        charCountExcl: v.charCountExcl ?? counts.charCountExcl,
        voiceFidelity: v.voiceFidelity ?? null,
        parentDraftId: parent?.id ?? null,
        note: v.note ?? null,
        isCurrent: makeCurrent,
        lockedParagraphs: keep(v.lockedParagraphs ?? parent?.lockedParagraphs ?? []),
        userEditedParagraphs: keep(v.userEditedParagraphs ?? parent?.userEditedParagraphs ?? []),
        usedFactCodes: v.usedFactCodes ?? citedCodes(content, "F"),
        usedStoryCodes: v.usedStoryCodes ?? citedCodes(content, "S"),
      })
      .returning();
    if (!row) throw new Error("Failed to save the draft version");
    return row;
  });
}

export async function getDraft(
  db: DbExecutor,
  userId: string,
  draftId: string,
): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.userId, assertId(userId, "userId")),
        eq(drafts.id, assertId(draftId, "draftId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getCurrentDraft(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.userId, assertId(userId, "userId")),
        eq(drafts.deliverableId, assertId(deliverableId, "deliverableId")),
        eq(drafts.isCurrent, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type DraftVersionSummary = Pick<
  DraftRow,
  | "id"
  | "version"
  | "author"
  | "angleId"
  | "parentDraftId"
  | "note"
  | "isCurrent"
  | "isFinal"
  | "stale"
  | "wordCount"
  | "charCountIncl"
  | "charCountExcl"
  | "createdAt"
>;

/** The version timeline, newest first, without the content. */
export async function listDraftVersions(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
): Promise<DraftVersionSummary[]> {
  return db
    .select({
      id: drafts.id,
      version: drafts.version,
      author: drafts.author,
      angleId: drafts.angleId,
      parentDraftId: drafts.parentDraftId,
      note: drafts.note,
      isCurrent: drafts.isCurrent,
      isFinal: drafts.isFinal,
      stale: drafts.stale,
      wordCount: drafts.wordCount,
      charCountIncl: drafts.charCountIncl,
      charCountExcl: drafts.charCountExcl,
      createdAt: drafts.createdAt,
    })
    .from(drafts)
    .where(
      and(
        eq(drafts.userId, assertId(userId, "userId")),
        eq(drafts.deliverableId, assertId(deliverableId, "deliverableId")),
      ),
    )
    .orderBy(desc(drafts.version));
}

/** Two versions of the same deliverable, for the inline diff. Null otherwise. */
export async function getDraftPair(
  db: DbExecutor,
  userId: string,
  draftA: string,
  draftB: string,
): Promise<{ a: DraftRow; b: DraftRow } | null> {
  const [a, b] = await Promise.all([getDraft(db, userId, draftA), getDraft(db, userId, draftB)]);
  if (!a || !b || a.deliverableId !== b.deliverableId) return null;
  return { a, b };
}

/**
 * Restores an earlier version by copying it into a new current version (history stays linear and
 * nothing is lost). The copy keeps the source's stale flag: its content is still what it was.
 */
export async function restoreDraftVersion(
  db: DbExecutor,
  userId: string,
  draftId: string,
): Promise<DraftRow | null> {
  const source = await getDraft(db, userId, draftId);
  if (!source) return null;
  return db.transaction(async (tx) => {
    const restored = await createDraftVersion(tx, userId, source.deliverableId, {
      author: "user",
      content: source.content,
      angleId: source.angleId,
      plainText: source.plainText,
      wordCount: source.wordCount,
      charCountIncl: source.charCountIncl,
      charCountExcl: source.charCountExcl,
      voiceFidelity: source.voiceFidelity,
      note: `Restored version ${source.version}`,
      lockedParagraphs: source.lockedParagraphs,
      userEditedParagraphs: source.userEditedParagraphs,
      usedFactCodes: source.usedFactCodes,
      usedStoryCodes: source.usedStoryCodes,
    });
    if (!restored || !source.stale) return restored;
    const [row] = await tx
      .update(drafts)
      .set({ stale: true, staleReason: source.staleReason })
      .where(eq(drafts.id, restored.id))
      .returning();
    return row ?? restored;
  });
}

/** Makes an existing version current ("Use this option"). */
export async function setCurrentDraft(
  db: DbExecutor,
  userId: string,
  draftId: string,
): Promise<DraftRow | null> {
  const ownerId = assertId(userId, "userId");
  const owned = await ownedDraft(db, ownerId, draftId);
  if (!owned) return null;
  return db.transaction(async (tx) => {
    await tx
      .update(drafts)
      .set({ isCurrent: false })
      .where(and(eq(drafts.deliverableId, owned.deliverableId), eq(drafts.isCurrent, true)));
    const [row] = await tx
      .update(drafts)
      .set({ isCurrent: true })
      .where(and(eq(drafts.userId, ownerId), eq(drafts.id, owned.id)))
      .returning();
    return row ?? null;
  });
}

export const DraftStatePatch = z
  .strictObject({
    /** Paragraph lock (`L`, §5.8): the AI never changes these. */
    lockedParagraphs: z.array(ParagraphId),
    userEditedParagraphs: z.array(ParagraphId),
    /** Only `false`: the applicant dismisses a stale flag (setting one is markDraftsStale's job). */
    stale: z.literal(false),
    voiceFidelity: z.number().min(0).max(1).nullable(),
  })
  .partial();
export type DraftStatePatch = z.input<typeof DraftStatePatch>;

/** Changes a version's flags in place; content never changes in place (that is a new version). */
export async function updateDraftState(
  db: DbExecutor,
  userId: string,
  draftId: string,
  patch: DraftStatePatch,
): Promise<DraftRow | null> {
  const values = DraftStatePatch.parse(patch);
  if (Object.keys(values).length === 0) return getDraft(db, userId, draftId);
  const [row] = await db
    .update(drafts)
    .set({ ...values, ...(values.stale === false ? { staleReason: null } : {}) })
    .where(
      and(
        eq(drafts.userId, assertId(userId, "userId")),
        eq(drafts.id, assertId(draftId, "draftId")),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * "Mark final" (§5.8): the version becomes current and final, any earlier final version of the
 * deliverable is unmarked, and the deliverable shows `final`. `final: false` undoes it.
 */
export async function markDraftFinal(
  db: DbExecutor,
  userId: string,
  draftId: string,
  final = true,
): Promise<DraftRow | null> {
  const ownerId = assertId(userId, "userId");
  const owned = await ownedDraft(db, ownerId, draftId);
  if (!owned) return null;
  return db.transaction(async (tx) => {
    await tx
      .update(drafts)
      .set({ isFinal: false, markedFinalAt: null, ...(final ? { isCurrent: false } : {}) })
      .where(
        and(
          eq(drafts.deliverableId, owned.deliverableId),
          ne(drafts.id, owned.id),
          final
            ? or(eq(drafts.isFinal, true), eq(drafts.isCurrent, true))
            : eq(drafts.isFinal, true),
        ),
      );
    const [row] = await tx
      .update(drafts)
      .set(
        final
          ? { isFinal: true, markedFinalAt: new Date(), isCurrent: true }
          : { isFinal: false, markedFinalAt: null },
      )
      .where(eq(drafts.id, owned.id))
      .returning();
    await tx
      .update(deliverables)
      .set({ status: final ? "final" : "draft_ready" })
      .where(eq(deliverables.id, owned.deliverableId));
    return row ?? null;
  });
}

/**
 * Flags every draft that used an edited fact or story (§5.3 AC: "This draft used the old team
 * size. Update it?"). Returns the ids it flagged.
 */
export async function markDraftsStale(
  db: DbExecutor,
  input: { userId: string; factCodes?: string[]; storyCodes?: string[]; reason: string },
): Promise<string[]> {
  const ownerId = assertId(input.userId, "userId");
  const facts = z.array(Code).parse(input.factCodes ?? []);
  const stories = z.array(Code).parse(input.storyCodes ?? []);
  const reason = Text.max(300).parse(input.reason);
  const overlaps: SQL[] = [];
  if (facts.length > 0) overlaps.push(sql`${drafts.usedFactCodes} && ${sql.param(facts)}::text[]`);
  if (stories.length > 0)
    overlaps.push(sql`${drafts.usedStoryCodes} && ${sql.param(stories)}::text[]`);
  if (overlaps.length === 0) return [];
  const rows = await db
    .update(drafts)
    .set({ stale: true, staleReason: reason })
    .where(and(eq(drafts.userId, ownerId), or(...overlaps)))
    .returning({ id: drafts.id });
  return rows.map((r) => r.id);
}

/* Checks ------------------------------------------------------------------------------------- */

export const NewCheck = z.strictObject({
  source: z.enum(checkSources),
  ruleId: Text.max(100),
  severity: z.enum(checkSeverities),
  location: z.strictObject({
    paragraph_id: z.string().nullable(),
    sentence: z.int().nonnegative().nullable(),
  }),
  explanation: Text,
  fixHint: z.string().trim().nullable().optional(),
  patch: z.unknown().optional(),
});
export type NewCheck = z.input<typeof NewCheck>;

const locationKey = (ruleId: string, l: CheckLocation) =>
  `${ruleId}|${l.paragraph_id ?? ""}|${l.sentence ?? ""}`;

/**
 * Replaces a draft's findings from the given sources (default both) after a lint or critic run
 * (§8.6 "re-runs only the affected linters"). A finding the applicant dismissed stays dismissed
 * when the same rule fires at the same place again.
 */
export async function replaceChecks(
  db: DbExecutor,
  userId: string,
  draftId: string,
  items: NewCheck[],
  options: { sources?: CheckSource[]; paragraphIds?: string[] } = {},
): Promise<CheckRow[] | null> {
  const ownerId = assertId(userId, "userId");
  const owned = await ownedDraft(db, ownerId, draftId);
  if (!owned) return null;
  const values = z.array(NewCheck).parse(items);
  const which = options.sources ?? [...checkSources];
  return db.transaction(async (tx) => {
    const scope = and(
      eq(checks.draftId, owned.id),
      inArray(checks.source, which),
      options.paragraphIds
        ? inArray(sql`${checks.location} ->> 'paragraph_id'`, options.paragraphIds)
        : undefined,
    );
    const dismissed = await tx
      .select({ ruleId: checks.ruleId, location: checks.location })
      .from(checks)
      .where(and(scope, eq(checks.status, "dismissed")));
    const keep = new Set(dismissed.map((d) => locationKey(d.ruleId, d.location)));
    await tx.delete(checks).where(scope);
    if (values.length === 0) return [];
    return tx
      .insert(checks)
      .values(
        values.map((v) => ({
          userId: ownerId,
          draftId: owned.id,
          source: v.source,
          ruleId: v.ruleId,
          severity: v.severity,
          location: v.location,
          explanation: v.explanation,
          fixHint: v.fixHint ?? null,
          patch: v.patch ?? null,
          status: keep.has(locationKey(v.ruleId, v.location))
            ? ("dismissed" as const)
            : ("open" as const),
        })),
      )
      .returning();
  });
}

export async function listChecks(
  db: DbExecutor,
  userId: string,
  draftId: string,
): Promise<CheckRow[]> {
  return db
    .select()
    .from(checks)
    .where(
      and(
        eq(checks.userId, assertId(userId, "userId")),
        eq(checks.draftId, assertId(draftId, "draftId")),
      ),
    )
    .orderBy(asc(checks.createdAt));
}

export async function setCheckStatus(
  db: DbExecutor,
  userId: string,
  checkId: string,
  status: CheckRow["status"],
): Promise<CheckRow | null> {
  const [row] = await db
    .update(checks)
    .set({ status: z.enum(checkStatuses).parse(status) })
    .where(
      and(
        eq(checks.userId, assertId(userId, "userId")),
        eq(checks.id, assertId(checkId, "checkId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* NEED items --------------------------------------------------------------------------------- */

export const NewNeedItem = z.strictObject({
  draftId: z.guid().nullable().optional(),
  paragraphId: ParagraphId.nullable().optional(),
  afterSentence: z.int().nonnegative().nullable().optional(),
  question: Text.max(500),
  approxWords: z.int().positive().nullable().optional(),
  blocking: z.boolean().optional(),
});
export type NewNeedItem = z.input<typeof NewNeedItem>;

/** Adds `[NEED]` items to a deliverable (§5.8). Null when the deliverable or draft is not the caller's. */
export async function createNeedItems(
  db: DbExecutor,
  userId: string,
  deliverableId: string,
  items: NewNeedItem[],
): Promise<NeedItem[] | null> {
  const ownerId = assertId(userId, "userId");
  const parent = await ownedDeliverable(db, ownerId, deliverableId);
  if (!parent) return null;
  const values = z.array(NewNeedItem).parse(items);
  const draftIds = [...new Set(values.flatMap((v) => (v.draftId ? [v.draftId] : [])))];
  if (draftIds.length > 0) {
    const found = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(
        and(
          eq(drafts.userId, ownerId),
          eq(drafts.deliverableId, parent.id),
          inArray(drafts.id, draftIds),
        ),
      );
    if (found.length !== draftIds.length) return null;
  }
  if (values.length === 0) return [];
  return db
    .insert(needItems)
    .values(
      values.map((v) => ({
        userId: ownerId,
        kitId: parent.kitId,
        deliverableId: parent.id,
        draftId: v.draftId ?? null,
        paragraphId: v.paragraphId ?? null,
        afterSentence: v.afterSentence ?? null,
        question: v.question,
        approxWords: v.approxWords ?? null,
        blocking: v.blocking ?? false,
      })),
    )
    .returning();
}

export async function listNeedItems(
  db: DbExecutor,
  userId: string,
  filter: { kitId?: string; deliverableId?: string; draftId?: string; status?: NeedItem["status"] },
): Promise<NeedItem[]> {
  const conditions: SQL[] = [eq(needItems.userId, assertId(userId, "userId"))];
  if (filter.kitId) conditions.push(eq(needItems.kitId, assertId(filter.kitId, "kitId")));
  if (filter.deliverableId)
    conditions.push(eq(needItems.deliverableId, assertId(filter.deliverableId, "deliverableId")));
  if (filter.draftId) conditions.push(eq(needItems.draftId, assertId(filter.draftId, "draftId")));
  if (filter.status)
    conditions.push(eq(needItems.status, z.enum(needStatuses).parse(filter.status)));
  return db
    .select()
    .from(needItems)
    .where(and(...conditions))
    .orderBy(asc(needItems.createdAt));
}

/** Records the applicant's answer (saved to the dossier as a `need_answer` source first). */
export async function answerNeedItem(
  db: DbExecutor,
  userId: string,
  needId: string,
  answerSourceId: string,
): Promise<NeedItem | null> {
  const ownerId = assertId(userId, "userId");
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(eq(sources.userId, ownerId), eq(sources.id, assertId(answerSourceId, "answerSourceId"))),
    )
    .limit(1);
  if (!source) return null;
  const [row] = await db
    .update(needItems)
    .set({ status: "answered", answerSourceId: source.id })
    .where(and(eq(needItems.userId, ownerId), eq(needItems.id, assertId(needId, "needId"))))
    .returning();
  return row ?? null;
}

/** Skips a NEED item, or reopens one. */
export async function setNeedStatus(
  db: DbExecutor,
  userId: string,
  needId: string,
  status: "open" | "skipped",
): Promise<NeedItem | null> {
  const [row] = await db
    .update(needItems)
    .set({ status: z.enum(["open", "skipped"]).parse(status) })
    .where(
      and(
        eq(needItems.userId, assertId(userId, "userId")),
        eq(needItems.id, assertId(needId, "needId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Verify items ------------------------------------------------------------------------------- */

export const NewVerifyItem = z.strictObject({
  deliverableId: z.guid().nullable().optional(),
  draftId: z.guid().nullable().optional(),
  text: Text.max(1000),
  reason: Text.max(500),
  cites: z.array(Code).optional(),
  url: z.url().nullable().optional(),
});
export type NewVerifyItem = z.input<typeof NewVerifyItem>;

/**
 * Adds items to the kit's Verify list (stage 10, §5.7). Re-collating is safe: an item with the same
 * deliverable and text as an existing one is skipped, so confirmed items stay confirmed. Null when
 * the kit, a deliverable or a draft is not the caller's.
 */
export async function addVerifyItems(
  db: DbExecutor,
  userId: string,
  kitId: string,
  items: NewVerifyItem[],
): Promise<VerifyItem[] | null> {
  const ownerId = assertId(userId, "userId");
  const kit = await ownedKit(db, ownerId, kitId);
  if (!kit) return null;
  const values = z.array(NewVerifyItem).parse(items);
  const deliverableIds = [
    ...new Set(values.flatMap((v) => (v.deliverableId ? [v.deliverableId] : []))),
  ];
  if (deliverableIds.length > 0) {
    const found = await db
      .select({ id: deliverables.id })
      .from(deliverables)
      .where(
        and(
          eq(deliverables.userId, ownerId),
          eq(deliverables.kitId, kit.id),
          inArray(deliverables.id, deliverableIds),
        ),
      );
    if (found.length !== deliverableIds.length) return null;
  }
  const draftIds = [...new Set(values.flatMap((v) => (v.draftId ? [v.draftId] : [])))];
  if (draftIds.length > 0) {
    const found = await db
      .select({ id: drafts.id })
      .from(drafts)
      .innerJoin(deliverables, eq(deliverables.id, drafts.deliverableId))
      .where(
        and(
          eq(drafts.userId, ownerId),
          eq(deliverables.kitId, kit.id),
          inArray(drafts.id, draftIds),
        ),
      );
    if (found.length !== draftIds.length) return null;
  }
  const existing = await db
    .select({ deliverableId: verifyItems.deliverableId, text: verifyItems.text })
    .from(verifyItems)
    .where(and(eq(verifyItems.userId, ownerId), eq(verifyItems.kitId, kit.id)));
  const seen = new Set(existing.map((e) => `${e.deliverableId ?? ""}|${e.text}`));
  const fresh = values.filter((v) => {
    const key = `${v.deliverableId ?? ""}|${v.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (fresh.length === 0) return [];
  return db
    .insert(verifyItems)
    .values(
      fresh.map((v) => ({
        userId: ownerId,
        kitId: kit.id,
        deliverableId: v.deliverableId ?? null,
        draftId: v.draftId ?? null,
        text: v.text,
        reason: v.reason,
        cites: v.cites ?? [],
        url: v.url ?? null,
      })),
    )
    .returning();
}

export async function listVerifyItems(
  db: DbExecutor,
  userId: string,
  kitId: string,
  filter: { deliverableId?: string; status?: VerifyItem["status"] } = {},
): Promise<VerifyItem[]> {
  const conditions: SQL[] = [
    eq(verifyItems.userId, assertId(userId, "userId")),
    eq(verifyItems.kitId, assertId(kitId, "kitId")),
  ];
  if (filter.deliverableId)
    conditions.push(eq(verifyItems.deliverableId, assertId(filter.deliverableId, "deliverableId")));
  if (filter.status)
    conditions.push(eq(verifyItems.status, z.enum(verifyStatuses).parse(filter.status)));
  return db
    .select()
    .from(verifyItems)
    .where(and(...conditions))
    .orderBy(asc(verifyItems.createdAt));
}

export const VerifyResolution = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("confirmed") }),
  z.strictObject({ status: z.literal("corrected"), correction: Text.max(2000) }),
  z.strictObject({ status: z.literal("open") }),
]);
export type VerifyResolution = z.input<typeof VerifyResolution>;

/** Confirm / correct (§5.8 Verify tab), or reopen. */
export async function resolveVerifyItem(
  db: DbExecutor,
  userId: string,
  verifyId: string,
  resolution: VerifyResolution,
): Promise<VerifyItem | null> {
  const value = VerifyResolution.parse(resolution);
  const [row] = await db
    .update(verifyItems)
    .set({
      status: value.status,
      correction: value.status === "corrected" ? value.correction : null,
      resolvedAt: value.status === "open" ? null : new Date(),
    })
    .where(
      and(
        eq(verifyItems.userId, assertId(userId, "userId")),
        eq(verifyItems.id, assertId(verifyId, "verifyId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Revision requests -------------------------------------------------------------------------- */

export const NewRevisionRequest = z.strictObject({
  instruction: Text.max(2000),
  quickAction: z.string().trim().min(1).max(60).nullable().optional(),
  targetParagraphs: z.array(ParagraphId).optional(),
});
export type NewRevisionRequest = z.input<typeof NewRevisionRequest>;

export async function createRevisionRequest(
  db: DbExecutor,
  userId: string,
  draftId: string,
  input: NewRevisionRequest,
): Promise<RevisionRequest | null> {
  const ownerId = assertId(userId, "userId");
  const owned = await ownedDraft(db, ownerId, draftId);
  if (!owned) return null;
  const v = NewRevisionRequest.parse(input);
  const [row] = await db
    .insert(revisionRequests)
    .values({
      userId: ownerId,
      draftId: owned.id,
      instruction: v.instruction,
      quickAction: v.quickAction ?? null,
      targetParagraphs: v.targetParagraphs ?? [],
    })
    .returning();
  return row ?? null;
}

export const RevisionUpdate = z
  .strictObject({
    status: z.enum(revisionStatuses),
    resultDraftId: z.guid().nullable(),
    summary: z.string().trim().max(500).nullable(),
    error: z.string().trim().max(2000).nullable(),
    targetParagraphs: z.array(ParagraphId),
  })
  .partial();
export type RevisionUpdate = z.input<typeof RevisionUpdate>;

/** Records the Reviser's result or the applicant's accept/reject. The result draft must be a version of the same deliverable. */
export async function updateRevisionRequest(
  db: DbExecutor,
  userId: string,
  requestId: string,
  update: RevisionUpdate,
): Promise<RevisionRequest | null> {
  const ownerId = assertId(userId, "userId");
  const values = RevisionUpdate.parse(update);
  const [request] = await db
    .select({ id: revisionRequests.id, deliverableId: drafts.deliverableId })
    .from(revisionRequests)
    .innerJoin(drafts, eq(drafts.id, revisionRequests.draftId))
    .where(
      and(
        eq(revisionRequests.userId, ownerId),
        eq(revisionRequests.id, assertId(requestId, "requestId")),
      ),
    )
    .limit(1);
  if (!request) return null;
  if (values.resultDraftId) {
    const result = await ownedDraft(db, ownerId, values.resultDraftId);
    if (!result || result.deliverableId !== request.deliverableId) return null;
  }
  const [row] = await db
    .update(revisionRequests)
    .set(values)
    .where(eq(revisionRequests.id, request.id))
    .returning();
  return row ?? null;
}

export async function getRevisionRequest(
  db: DbExecutor,
  userId: string,
  requestId: string,
): Promise<RevisionRequest | null> {
  const [row] = await db
    .select()
    .from(revisionRequests)
    .where(
      and(
        eq(revisionRequests.userId, assertId(userId, "userId")),
        eq(revisionRequests.id, assertId(requestId, "requestId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listRevisionRequests(
  db: DbExecutor,
  userId: string,
  draftId: string,
): Promise<RevisionRequest[]> {
  return db
    .select()
    .from(revisionRequests)
    .where(
      and(
        eq(revisionRequests.userId, assertId(userId, "userId")),
        eq(revisionRequests.draftId, assertId(draftId, "draftId")),
      ),
    )
    .orderBy(desc(revisionRequests.createdAt));
}

/* Feedback ----------------------------------------------------------------------------------- */

export const NewFeedback = z.strictObject({
  targetType: z.string().trim().min(1).max(40),
  targetId: z.guid(),
  /** −1/1 for thumbs, or a 1–5 score. */
  rating: z.int().min(-1).max(5).nullable().optional(),
  reason: z.string().trim().max(200).nullable().optional(),
  text: z.string().trim().max(4000).nullable().optional(),
});
export type NewFeedback = z.input<typeof NewFeedback>;

export async function recordFeedback(
  db: DbExecutor,
  userId: string,
  input: NewFeedback,
): Promise<FeedbackRow> {
  const v = NewFeedback.parse(input);
  const [row] = await db
    .insert(feedback)
    .values({
      userId: assertId(userId, "userId"),
      targetType: v.targetType,
      targetId: v.targetId,
      rating: v.rating ?? null,
      reason: v.reason ?? null,
      text: v.text ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to record feedback");
  return row;
}
