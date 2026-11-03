import "server-only";

import {
  getDb,
  getResumeReview,
  isPaidUser,
  latestResumeReview,
  latestResumeSource,
  type ResumeReviewRow,
} from "@admitstory/db";
import type { ConsistencyFinding } from "@admitstory/linters";
import type { BulletDecision, ResumeReview } from "@admitstory/shared/kit";
import { ApiError } from "@/lib/api";
import { consistencyReport, findingsFor, RESUME_DOC } from "./consistency";
import { strictestPageLimit, type PageLimit } from "./resume";

// The Résumé page (spec §5.10, Résumé Pass), as plain JSON for /resume and GET /api/resume/review.
// Per applicant: one review per uploaded résumé, shared by every kit (Phase 5 decision).

export type ResumeView =
  | { state: "locked" }
  /** No résumé uploaded yet; `stale` when the newest upload has no review (one is a click away). */
  | { state: "no_resume" }
  | { state: "not_reviewed"; fileName: string | null }
  | {
      state: "ready";
      reviewId: string;
      review: ResumeReview;
      decisions: Record<string, BulletDecision>;
      useSuggestedOrder: boolean;
      pageLimit: PageLimit | null;
      consistency: ConsistencyFinding[];
      /** A newer résumé was uploaded since this review. */
      newerUpload: boolean;
    };

export async function loadResumeView(userId: string): Promise<ResumeView> {
  const db = getDb();
  if (!(await isPaidUser(db, userId))) return { state: "locked" };
  const [source, review] = await Promise.all([
    latestResumeSource(db, userId),
    latestResumeReview(db, userId),
  ]);
  if (!review)
    return source ? { state: "not_reviewed", fileName: source.fileName } : { state: "no_resume" };
  const [pageLimit, report] = await Promise.all([
    strictestPageLimit(db, userId),
    consistencyReport(db, userId),
  ]);
  return {
    state: "ready",
    reviewId: review.id,
    review: review.content,
    decisions: review.decisions,
    useSuggestedOrder: review.useSuggestedOrder,
    pageLimit,
    consistency: findingsFor(report, new Set([RESUME_DOC])),
    newerUpload: source !== null && source.id !== review.sourceId,
  };
}

/** One of the applicant's reviews, or 404. The Résumé Pass needs a kit (402 otherwise). */
export async function ownResumeReview(userId: string, reviewId: string): Promise<ResumeReviewRow> {
  const db = getDb();
  if (!(await isPaidUser(db, userId)))
    throw new ApiError(402, "The Résumé Pass comes with your first School Kit.");
  const review = await getResumeReview(db, userId, reviewId);
  if (!review) throw new ApiError(404, "That résumé review could not be found.");
  return review;
}
