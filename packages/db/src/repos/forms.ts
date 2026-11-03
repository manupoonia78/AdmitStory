// The Form Advisor, the Résumé Pass and consistency dismissals (spec §5.10), Phase 5. Every
// statement is scoped to the owner; a kit or source that isn't theirs finds nothing.

import type { BulletDecision, FormAdvice, ResumeReview } from "@admitstory/shared/kit";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { decryptContent, getContentKeyring } from "../crypto/content";
import {
  consistencyDismissals,
  formAdvice,
  resumeReviews,
  sources,
  type FormAdviceRow,
  type ResumeReviewRow,
} from "../schema";
import { assertId } from "./ids";
import { getKit } from "./kits";

export type { FormAdviceRow, ResumeReviewRow };

/* Form advice -------------------------------------------------------------------------------- */

export async function getFormAdvice(
  db: DbExecutor,
  userId: string,
  kitId: string,
): Promise<FormAdviceRow | null> {
  const [row] = await db
    .select()
    .from(formAdvice)
    .where(
      and(
        eq(formAdvice.userId, assertId(userId, "userId")),
        eq(formAdvice.kitId, assertId(kitId, "kitId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Saves the advice for a kit the user owns. A refresh replaces the advice and bumps the version;
 * the applicant's own edits are kept. Returns null when the kit isn't theirs.
 */
export async function saveFormAdvice(
  db: DbExecutor,
  userId: string,
  kitId: string,
  input: {
    mode: "draft" | "coach";
    content: FormAdvice;
    trimmed: string[];
    dossierSnapshotVersion: number;
    packVersion: number;
  },
): Promise<FormAdviceRow | null> {
  const kit = await getKit(db, userId, kitId);
  if (!kit) return null;
  const [row] = await db
    .insert(formAdvice)
    .values({ userId: kit.userId, kitId: kit.id, ...input })
    .onConflictDoUpdate({
      target: formAdvice.kitId,
      set: {
        ...input,
        version: sql`${formAdvice.version} + 1`,
        updatedAt: sql`now()`,
      },
      // The conflict target is the kit, which belongs to this user; the guard keeps it that way.
      setWhere: eq(formAdvice.userId, kit.userId),
    })
    .returning();
  return row ?? null;
}

/** The applicant's own text for one entry ("section/item"); null clears it back to the advice. */
export async function setFormEdit(
  db: DbExecutor,
  userId: string,
  kitId: string,
  key: string,
  text: string | null,
): Promise<FormAdviceRow | null> {
  const edits =
    text === null
      ? sql`${formAdvice.edits} - ${key}::text`
      : sql`${formAdvice.edits} || jsonb_build_object(${key}::text, ${text}::text)`;
  const [row] = await db
    .update(formAdvice)
    .set({ edits, updatedAt: sql`now()` })
    .where(
      and(
        eq(formAdvice.userId, assertId(userId, "userId")),
        eq(formAdvice.kitId, assertId(kitId, "kitId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Résumé Pass -------------------------------------------------------------------------------- */

/** Source kinds an uploaded document is stored under (Phase 1 uploads). */
const DOCUMENT_KINDS = ["upload", "import"] as const;

export interface ResumeSource {
  id: string;
  text: string;
  fileName: string | null;
  createdAt: Date;
}

/** The applicant's newest uploaded résumé (`meta.documentKind = "resume"`), decrypted. */
export async function latestResumeSource(
  db: DbExecutor,
  userId: string,
): Promise<ResumeSource | null> {
  const [row] = await db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.userId, assertId(userId, "userId")),
        inArray(sources.kind, [...DOCUMENT_KINDS]),
        sql`${sources.meta}->>'documentKind' = 'resume'`,
      ),
    )
    .orderBy(desc(sources.createdAt))
    .limit(1);
  if (!row?.textEncrypted) return null;
  const fileName = row.meta?.["fileName"];
  return {
    id: row.id,
    text: decryptContent(getContentKeyring(), row.textEncrypted),
    fileName: typeof fileName === "string" ? fileName : null,
    createdAt: row.createdAt,
  };
}

export async function getResumeReviewForSource(
  db: DbExecutor,
  userId: string,
  sourceId: string,
): Promise<ResumeReviewRow | null> {
  const [row] = await db
    .select()
    .from(resumeReviews)
    .where(
      and(
        eq(resumeReviews.userId, assertId(userId, "userId")),
        eq(resumeReviews.sourceId, assertId(sourceId, "sourceId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getResumeReview(
  db: DbExecutor,
  userId: string,
  reviewId: string,
): Promise<ResumeReviewRow | null> {
  const [row] = await db
    .select()
    .from(resumeReviews)
    .where(
      and(
        eq(resumeReviews.userId, assertId(userId, "userId")),
        eq(resumeReviews.id, assertId(reviewId, "reviewId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The review of the newest résumé that has one. */
export async function latestResumeReview(
  db: DbExecutor,
  userId: string,
): Promise<ResumeReviewRow | null> {
  const [row] = await db
    .select()
    .from(resumeReviews)
    .where(eq(resumeReviews.userId, assertId(userId, "userId")))
    .orderBy(desc(resumeReviews.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Saves the review of one of the user's own résumés. Re-reviewing the same résumé replaces the
 * review and clears the decisions, which point at bullet ids of the old one.
 */
export async function saveResumeReview(
  db: DbExecutor,
  userId: string,
  sourceId: string,
  input: { content: ResumeReview; dossierSnapshotVersion: number },
): Promise<ResumeReviewRow | null> {
  const ownerId = assertId(userId, "userId");
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.userId, ownerId), eq(sources.id, assertId(sourceId, "sourceId"))))
    .limit(1);
  if (!source) return null;
  const [row] = await db
    .insert(resumeReviews)
    .values({ userId: ownerId, sourceId: source.id, ...input })
    .onConflictDoUpdate({
      target: resumeReviews.sourceId,
      set: { ...input, decisions: {}, updatedAt: sql`now()` },
      setWhere: eq(resumeReviews.userId, ownerId),
    })
    .returning();
  return row ?? null;
}

/** One bullet's decision; null undoes it. */
export async function setBulletDecision(
  db: DbExecutor,
  userId: string,
  reviewId: string,
  bulletId: string,
  decision: BulletDecision | null,
): Promise<ResumeReviewRow | null> {
  const decisions =
    decision === null
      ? sql`${resumeReviews.decisions} - ${bulletId}::text`
      : sql`${resumeReviews.decisions} || jsonb_build_object(${bulletId}::text, ${JSON.stringify(decision)}::jsonb)`;
  const [row] = await db
    .update(resumeReviews)
    .set({ decisions, updatedAt: sql`now()` })
    .where(
      and(
        eq(resumeReviews.userId, assertId(userId, "userId")),
        eq(resumeReviews.id, assertId(reviewId, "reviewId")),
      ),
    )
    .returning();
  return row ?? null;
}

export async function setResumeOrder(
  db: DbExecutor,
  userId: string,
  reviewId: string,
  useSuggestedOrder: boolean,
): Promise<ResumeReviewRow | null> {
  const [row] = await db
    .update(resumeReviews)
    .set({ useSuggestedOrder, updatedAt: sql`now()` })
    .where(
      and(
        eq(resumeReviews.userId, assertId(userId, "userId")),
        eq(resumeReviews.id, assertId(reviewId, "reviewId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Consistency dismissals --------------------------------------------------------------------- */

export async function listDismissedFindings(db: DbExecutor, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ findingId: consistencyDismissals.findingId })
    .from(consistencyDismissals)
    .where(eq(consistencyDismissals.userId, assertId(userId, "userId")));
  return new Set(rows.map((r) => r.findingId));
}

export async function dismissFinding(
  db: DbExecutor,
  userId: string,
  findingId: string,
): Promise<void> {
  await db
    .insert(consistencyDismissals)
    .values({ userId: assertId(userId, "userId"), findingId: findingId.slice(0, 120) })
    .onConflictDoNothing();
}

export async function restoreFinding(
  db: DbExecutor,
  userId: string,
  findingId: string,
): Promise<void> {
  await db
    .delete(consistencyDismissals)
    .where(
      and(
        eq(consistencyDismissals.userId, assertId(userId, "userId")),
        eq(consistencyDismissals.findingId, findingId),
      ),
    );
}
