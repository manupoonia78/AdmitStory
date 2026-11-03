import "server-only";

// The two database reads on the public marketing pages (plan §3.7, deviation D4): the schools with
// a published pack (the FAQ) and the verified AI policies (/ and /how-it-works). No session.
//
// Each is memoised in process for an hour, gives up after 2 seconds, and answers [] on any error,
// which the pages read as "nothing verified yet" (a fallback sentence, never a broken table).
// Only the error's name is logged.

import {
  getDb,
  listSeedSchools,
  listVerifiedAiPolicies,
  type VerifiedAiPolicyRow,
} from "@admitstory/db";

export const PUBLIC_DATA_TTL_MS = 60 * 60 * 1000;
export const PUBLIC_DATA_TIMEOUT_MS = 2000;

export interface PackSchool {
  name: string;
  shortName: string;
}

export type PublicAiPolicy = VerifiedAiPolicyRow;

interface Memo<T> {
  value: T;
  at: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DOMException("timed out", "TimeoutError")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("query failed"));
      },
    );
  });
}

/**
 * A soft-failing, memoised read. Concurrent callers share one in-flight query. A failure is not
 * memoised for the full hour: it is retried after a minute.
 */
export function memoised<T>(
  label: string,
  load: () => Promise<T[]>,
  { ttlMs = PUBLIC_DATA_TTL_MS, timeoutMs = PUBLIC_DATA_TIMEOUT_MS, now = () => Date.now() } = {},
): { read: () => Promise<T[]>; reset: () => void } {
  let memo: Memo<T[]> | null = null;
  let inflight: Promise<T[]> | null = null;
  const FAILURE_TTL_MS = 60 * 1000;
  let failedAt: number | null = null;

  async function read(): Promise<T[]> {
    const at = now();
    if (memo && at - memo.at < ttlMs) return memo.value;
    if (failedAt !== null && at - failedAt < FAILURE_TTL_MS) return memo?.value ?? [];
    inflight ??= withTimeout(load(), timeoutMs)
      .then((value) => {
        memo = { value, at: now() };
        failedAt = null;
        return value;
      })
      .catch((error: unknown) => {
        console.warn(`[marketing] ${label} unavailable`, {
          error: error instanceof Error ? error.name : "unknown",
        });
        failedAt = now();
        return memo?.value ?? [];
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return {
    read,
    reset: () => {
      memo = null;
      inflight = null;
      failedAt = null;
    },
  };
}

const packSchoolsMemo = memoised<PackSchool>("pack schools", async () => {
  const schools = await listSeedSchools(getDb());
  return schools
    .filter((school) => school.publishedPack !== null)
    .map((school) => ({ name: school.name, shortName: school.shortName }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const policiesMemo = memoised<PublicAiPolicy>("ai policies", async () => {
  const rows = await listVerifiedAiPolicies(getDb());
  // The repo filters in SQL; this keeps the rule here too: nothing unverified is ever shown.
  // Rows come newest cycle first within each school: keep one row per school.
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!(row.verifiedAt instanceof Date) || seen.has(row.schoolSlug)) return false;
    seen.add(row.schoolSlug);
    return true;
  });
});

/** Schools whose kit can be bought now (a published pack), by name. [] on any error. */
export function packSchools(): Promise<PackSchool[]> {
  return packSchoolsMemo.read();
}

/** Verified AI policies, by school name then newest cycle. [] on any error or before verification. */
export function verifiedPolicies(): Promise<PublicAiPolicy[]> {
  return policiesMemo.read();
}
