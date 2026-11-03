import "server-only";

import {
  getDb,
  getResumeReviewForSource,
  isPaidUser,
  latestResumeSource,
  listUserSchools,
  saveResumeReview,
  type DbExecutor,
  type ResumeReviewRow,
} from "@admitstory/db";
import type { KitAI } from "@/lib/kit/pipeline";
import { ensureSnapshot } from "@/lib/strategy/jobs";
import { asPack } from "@/lib/strategy/pack";
import { latestPack } from "@/lib/strategy/server";

// The Résumé Pass (spec §5.10): one review per uploaded résumé, per applicant rather than per
// school, unlocked by owning any active kit ("included with the first kit; free afterwards" —
// Phase 5 decision). Pipeline stage 9 runs it once when a résumé has been uploaded and not yet
// reviewed; the Résumé page can run it again for a newer upload.

/** Résumé text sent to the reviewer; a résumé is one or two pages, so this is generous. */
const RESUME_CHARS = 24_000;

export interface PageLimit {
  pages: number;
  /** The schools that ask for that many pages. */
  schools: string[];
}

/** The strictest page limit among the applicant's schools with a published pack. */
export async function strictestPageLimit(
  db: DbExecutor,
  userId: string,
): Promise<PageLimit | null> {
  const schools = await listUserSchools(db, userId);
  const limits = (
    await Promise.all(
      schools.map(async (s) => {
        const pack = await latestPack(db, s.cycle.id);
        const pages = pack ? asPack(pack.data).application.resume?.page_limit : undefined;
        return pages ? { pages, school: s.school.shortName || s.school.name } : null;
      }),
    )
  ).filter((l): l is { pages: number; school: string } => l !== null);
  if (limits.length === 0) return null;
  const pages = Math.min(...limits.map((l) => l.pages));
  return { pages, schools: limits.filter((l) => l.pages === pages).map((l) => l.school) };
}

export class ResumeLockedError extends Error {
  override name = "ResumeLockedError";
}

/**
 * Reviews the applicant's newest résumé. Returns the stored review when that résumé already has
 * one (unless `force`), with `fresh: false`, and null when no résumé has been uploaded.
 */
export async function reviewLatestResume(
  ai: KitAI,
  userId: string,
  options: { force?: boolean; db?: DbExecutor } = {},
): Promise<{ review: ResumeReviewRow; fresh: boolean } | null> {
  const db = options.db ?? getDb();
  if (!(await isPaidUser(db, userId)))
    throw new ResumeLockedError("The Résumé Pass comes with your first School Kit.");
  const source = await latestResumeSource(db, userId);
  if (!source?.text.trim()) return null;
  const existing = await getResumeReviewForSource(db, userId, source.id);
  if (existing && !options.force) return { review: existing, fresh: false };

  const [limit, snapshot] = await Promise.all([
    strictestPageLimit(db, userId),
    ensureSnapshot(userId),
  ]);
  const content = await ai.run(
    "resume.review",
    { resume_text: source.text.slice(0, RESUME_CHARS), page_limit: limit?.pages ?? null },
    { userId, dossier: snapshot.compactText },
  );
  const review = await saveResumeReview(db, userId, source.id, {
    content,
    dossierSnapshotVersion: snapshot.version,
  });
  return review ? { review, fresh: true } : null;
}
