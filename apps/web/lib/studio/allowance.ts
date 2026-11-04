import "server-only";

import { countUserTurns, getDb, isPaidUser } from "@admitstory/db";
import { ApiError } from "@/lib/api-error";

// The free half of Story Studio (Manu, 2026-11-04). Every answer costs an Interviewer call and an
// Extractor call, so an applicant who hasn't bought a school pack gets the first half of a full
// Studio free, and then a prompt to unlock a school. A Deep Studio (60–90 min) runs to about 60
// answers, so the free half is 30. Answers are counted across every session, so starting a fresh
// session doesn't reset it. Anyone holding a school-kit entitlement has no Studio limit.

/** Answers a free account can give in Story Studio: half of a full (Deep) Studio. */
export const FREE_STUDIO_ANSWERS = 30;

/** From this many answers left, the Studio says how many remain. */
export const STUDIO_ALLOWANCE_WARNING = 5;

export interface StudioAllowance {
  /** Holds a school kit, so the Studio has no limit. */
  paid: boolean;
  /** Answers given so far, across every session. */
  used: number;
  /** FREE_STUDIO_ANSWERS, or null when paid. */
  limit: number | null;
}

export async function studioAllowance(userId: string): Promise<StudioAllowance> {
  const db = getDb();
  const [paid, used] = await Promise.all([isPaidUser(db, userId), countUserTurns(db, userId)]);
  return { paid, used, limit: paid ? null : FREE_STUDIO_ANSWERS };
}

export function studioLimitReached(allowance: StudioAllowance): boolean {
  return allowance.limit !== null && allowance.used >= allowance.limit;
}

/** Answers left before the free half ends; null when there is no limit. */
export function answersLeft(allowance: StudioAllowance): number | null {
  return allowance.limit === null ? null : Math.max(0, allowance.limit - allowance.used);
}

/** The 402 every Studio route throws once the free half is used up. The client branches on `code`. */
export function studioLimitError(allowance: StudioAllowance): ApiError {
  return new ApiError(
    402,
    "You’ve used the free half of Story Studio. Unlock a school to keep going.",
    undefined,
    "studio_limit",
    { allowance: { used: allowance.used, limit: allowance.limit } },
  );
}
