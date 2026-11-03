// The shape apps/web keeps in `user_schools.fit` (packages/db leaves it to the strategy code):
// strategy.school_fit's validated output, the retrieved chunks it was allowed to cite (so their
// sources can still be shown later), and the kit preview's job state, which has no column of its
// own. Pure and plain, so pages and tests read it the same way.

import type { SchoolFit } from "@admitstory/shared/kit";
import type { RetrievalSource } from "./pack";

export interface PreviewJob {
  state: "running" | "failed" | "budget";
  /** ISO instant the state was entered. */
  at: string;
}

export interface StoredFit {
  v: 1;
  /** Null until strategy.school_fit has run for this school. */
  output: SchoolFit | null;
  retrieval: RetrievalSource[];
  /** ISO instant the output was computed. */
  computedAt: string | null;
  previewJob: PreviewJob | null;
}

export const EMPTY_FIT: StoredFit = {
  v: 1,
  output: null,
  retrieval: [],
  computedAt: null,
  previewJob: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads whatever is stored, tolerating rows written before a field existed. The output itself was
 * validated by ai.run before it was saved, so only its outline is checked here.
 */
export function readStoredFit(value: unknown): StoredFit {
  if (!isRecord(value) || value.v !== 1) return EMPTY_FIT;
  const output =
    isRecord(value.output) && Array.isArray(value.output.honest_flags)
      ? (value.output as unknown as SchoolFit)
      : null;
  const retrieval = Array.isArray(value.retrieval)
    ? (value.retrieval.filter(
        (r) => isRecord(r) && typeof r.id === "string" && typeof r.source === "string",
      ) as RetrievalSource[])
    : [];
  const job = isRecord(value.previewJob) ? value.previewJob : null;
  const previewJob =
    job &&
    (job.state === "running" || job.state === "failed" || job.state === "budget") &&
    typeof job.at === "string"
      ? { state: job.state as PreviewJob["state"], at: job.at }
      : null;
  return {
    v: 1,
    output,
    retrieval,
    computedAt: typeof value.computedAt === "string" ? value.computedAt : null,
    previewJob,
  };
}

/** For `saveUserSchoolFit`, which takes a plain record. */
export function toRecord(fit: StoredFit): Record<string, unknown> {
  return { ...fit } as unknown as Record<string, unknown>;
}

/**
 * A "running" job older than this is treated as lost (a crashed worker never wrote "failed"), so
 * the applicant can ask again instead of waiting forever.
 */
export const PREVIEW_JOB_TIMEOUT_MS = 10 * 60_000;

export function previewJobActive(job: PreviewJob | null, now: Date): boolean {
  return (
    job?.state === "running" && now.getTime() - new Date(job.at).getTime() < PREVIEW_JOB_TIMEOUT_MS
  );
}
