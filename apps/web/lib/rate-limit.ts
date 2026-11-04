import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { createHash } from "node:crypto";
import { raiseAdminAlert } from "@/lib/alerts";
import { ApiError } from "@/lib/api-error";
import { redis } from "@/lib/redis";

// Rate limits (spec §12.4). With Upstash configured they are a sliding window shared by every
// instance; without it, or while Upstash is unreachable, an in-process window stands in (it
// protects one instance from a runaway client; budget caps still guard cost). A store outage is
// logged and raised as an admin alert at most once a minute, and requests fail open to memory.

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

/** Spec §12.4's limits, plus the ones later phases added. */
export const RATE_LIMITS = {
  studioTurns: { limit: 30, windowMs: 60_000 },
  tts: { limit: 60, windowMs: 60_000 },
  /** Not in §12.4: one token per dictated answer, so this only stops a runaway client. */
  sttToken: { limit: 20, windowMs: 60_000 },
  uploads: { limit: 10, windowMs: 60_000 },
  dossierWrites: { limit: 120, windowMs: 60_000 },
  /** Phase 9b. */
  accountExport: { limit: 3, windowMs: 60 * 60_000 },
  accountDelete: { limit: 5, windowMs: 60 * 60_000 },
  feedback: { limit: 20, windowMs: 60 * 60_000 },
  privacyPrefs: { limit: 30, windowMs: 60 * 60_000 },
  /** Connect (2026-11-04): directory searches and messages. */
  connectSearch: { limit: 60, windowMs: 60_000 },
  connectMessages: { limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, RateLimit>;

const TOO_FAST = "That's faster than we can keep up with. Try again in a moment.";

/* In-process fallback ------------------------------------------------------------------------ */

const buckets = new Map<string, number[]>();

function memoryLimit(bucketKey: string, { limit, windowMs }: RateLimit): boolean {
  const now = Date.now();
  const recent = (buckets.get(bucketKey) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    buckets.set(bucketKey, recent);
    return false;
  }
  recent.push(now);
  buckets.set(bucketKey, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (buckets.size > 10_000)
    for (const [candidate, times] of buckets)
      if (times.every((at) => now - at >= windowMs)) buckets.delete(candidate);
  return true;
}

/* Upstash ------------------------------------------------------------------------------------ */

const limiters = new Map<string, Ratelimit>();
let lastOutageReport = 0;

function limiterFor(limit: RateLimit): Ratelimit | null {
  const client = redis();
  if (!client) return null;
  const id = `${limit.limit}/${limit.windowMs}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit.limit, `${limit.windowMs} ms`),
      prefix: "as:rl",
      analytics: false,
      // An unreachable store must not hang a request: fail over to memory after a second.
      timeout: 1_000,
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

function reportOutage(error: unknown): void {
  const now = Date.now();
  if (now - lastOutageReport < 60_000) return;
  lastOutageReport = now;
  console.error("[rate-limit] Upstash failed; using the in-process limiter:", error);
  void raiseAdminAlert({
    kind: "rate_limit_store_down",
    key: `rate_limit_store_down:${new Date().toISOString().slice(0, 13)}`,
    severity: "warn",
    title: "The rate-limit store is unreachable",
    detail: { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
  });
}

async function allow(bucketKey: string, limit: RateLimit): Promise<boolean> {
  const limiter = limiterFor(limit);
  if (!limiter) return memoryLimit(bucketKey, limit);
  try {
    const result = await limiter.limit(bucketKey);
    return result.success;
  } catch (error) {
    reportOutage(error);
    return memoryLimit(bucketKey, limit);
  }
}

/** Throws ApiError(429) when `subject` (usually a user id) is over `limit` for `key`. */
export async function checkRateLimit(
  key: string,
  subject: string,
  limit: RateLimit,
): Promise<void> {
  if (!(await allow(`${key}:${subject}`, limit))) throw new ApiError(429, TOO_FAST);
}

/** The caller's IP, hashed and truncated so it is never stored as-is. */
export function ipSubject(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`as-ip:${ip}`).digest("hex").slice(0, 24);
}

/** Like checkRateLimit, keyed on the caller's (hashed) IP, for routes without a user. */
export async function checkIpRateLimit(
  key: string,
  request: Request,
  limit: RateLimit,
): Promise<void> {
  await checkRateLimit(key, ipSubject(request), limit);
}

/** Test seam: forget the in-process windows. */
export function resetRateLimits(): void {
  buckets.clear();
}
