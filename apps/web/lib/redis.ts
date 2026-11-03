import "server-only";

import { Redis } from "@upstash/redis";

// Upstash Redis over REST (spec §12.4): shared state for rate limits and idempotency across
// serverless instances. Vercel's Marketplace integration names the same pair KV_REST_API_*.
// Without either pair this returns null and callers fall back to their in-process versions.

const globalForRedis = globalThis as typeof globalThis & { __admitstoryRedis?: Redis | null };

export function redis(): Redis | null {
  if (globalForRedis.__admitstoryRedis !== undefined) return globalForRedis.__admitstoryRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  globalForRedis.__admitstoryRedis = url && token ? new Redis({ url, token }) : null;
  return globalForRedis.__admitstoryRedis;
}

/** Test seam. */
export function setRedisForTests(client: Redis | null | undefined): void {
  if (client === undefined) delete globalForRedis.__admitstoryRedis;
  else globalForRedis.__admitstoryRedis = client;
}
