// public-route: uptime check; reports reachability only, never a secret or a row.
import { getDb, pingDb } from "@admitstory/db";
import { redis } from "@/lib/redis";

// GET /api/health (Phase 9b §11): for the uptime monitor and the go-live checklist. 200 when the
// database answers, else 503. Redis is "off" when it isn't configured (the in-process limiter
// runs) and "down" when it is configured but not answering; neither fails the check.

export const dynamic = "force-dynamic";

async function probe(work: () => Promise<unknown>, ms = 3_000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(): Promise<Response> {
  const client = redis();
  const [db, cache] = await Promise.all([
    probe(() => pingDb(getDb())),
    client ? probe(() => client.ping()) : Promise.resolve(null),
  ]);
  const body = {
    ok: db,
    db: db ? "ok" : "down",
    redis: cache === null ? "off" : cache ? "ok" : "down",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };
  return Response.json(body, { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
