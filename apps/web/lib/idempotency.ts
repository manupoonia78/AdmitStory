import "server-only";

import { ApiError } from "@/lib/api-error";
import { redis } from "@/lib/redis";

// Idempotency-Key for creating or costly POSTs (spec §11). A repeat of the same key by the same
// owner within ten minutes gets the first response again, so a double click never creates two
// recommenders or opens two checkouts. Errors are not remembered: a failed request can be retried
// with the same key.
//
// With Upstash configured (Phase 9b) the record is shared by every instance: the first request
// claims the key (SET NX), a repeat that arrives while it is still running gets 409, and the
// finished response (status < 500, JSON ≤ 256 KB) is replayed with `Idempotent-Replayed: true`.
// Without Upstash, or if it errors, the in-process map below does the same for one instance, where
// a repeat in flight waits for the first instead.

const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 2_000;
const MAX_STORED_BYTES = 256 * 1024;
const KEY = /^[A-Za-z0-9._:-]{8,120}$/;
const PENDING = "pending";

interface Result {
  status: number;
  body: unknown;
}

/* In-process ------------------------------------------------------------------------------- */

interface Stored {
  at: number;
  result: Promise<Result>;
}

const store = new Map<string, Stored>();

function sweep(now: number): void {
  for (const [key, entry] of store) if (now - entry.at > TTL_MS) store.delete(key);
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

async function inProcess(cacheKey: string, run: () => Promise<Result>): Promise<Result> {
  const now = Date.now();
  sweep(now);
  let entry = store.get(cacheKey);
  if (!entry) {
    const result = run();
    entry = { at: now, result };
    store.set(cacheKey, entry);
    result.catch(() => {
      if (store.get(cacheKey)?.result === result) store.delete(cacheKey);
    });
  }
  return entry.result;
}

/* Upstash ---------------------------------------------------------------------------------- */

async function shared(
  cacheKey: string,
  run: () => Promise<Result>,
): Promise<{ result: Result; replayed: boolean } | null> {
  const client = redis();
  if (!client) return null;
  const redisKey = `as:idem:${cacheKey}`;
  let claimed: string | null;
  try {
    claimed = await client.set(redisKey, PENDING, { nx: true, px: TTL_MS });
  } catch (error) {
    console.error("[idempotency] Upstash failed; using the in-process store:", error);
    return null;
  }
  if (claimed === null) {
    const stored = await client.get<Result | string>(redisKey).catch(() => null);
    if (stored && typeof stored === "object") return { result: stored, replayed: true };
    throw new ApiError(409, "That request is still running.");
  }
  let result: Result;
  try {
    result = await run();
  } catch (error) {
    await client.del(redisKey).catch(() => undefined);
    throw error;
  }
  const size = JSON.stringify(result.body ?? null).length;
  if (result.status < 500 && size <= MAX_STORED_BYTES)
    await client.set(redisKey, result, { px: TTL_MS }).catch(() => undefined);
  else await client.del(redisKey).catch(() => undefined);
  return { result, replayed: false };
}

/* API ------------------------------------------------------------------------------------- */

/** The request's Idempotency-Key when it is well formed, else null (the request just runs). */
export function idempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key")?.trim();
  return key && KEY.test(key) ? key : null;
}

/**
 * Runs `run` once per (scope, owner, Idempotency-Key) and answers repeats with the same status and
 * JSON body. Without a key, `run` simply runs. `ownerId` is the user id, or the invite id on the
 * recommender portal, so two people never share a cached answer.
 */
export async function withIdempotency(
  request: Request,
  scope: string,
  ownerId: string,
  run: () => Promise<Result>,
): Promise<Response> {
  const key = idempotencyKey(request);
  if (!key) {
    const { status, body } = await run();
    return Response.json(body, { status });
  }
  const cacheKey = `${scope}\u0000${ownerId}\u0000${key}`;
  const viaRedis = await shared(cacheKey, run);
  const { result, replayed } = viaRedis ?? {
    result: await inProcess(cacheKey, run),
    replayed: false,
  };
  return Response.json(result.body, {
    status: result.status,
    headers: {
      "Idempotency-Key": key,
      ...(replayed ? { "Idempotent-Replayed": "true" } : {}),
    },
  });
}

/** Test seam: forget every stored response. */
export function resetIdempotency(): void {
  store.clear();
}
