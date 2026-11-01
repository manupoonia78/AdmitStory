import { getDb, getLatestProfileRead } from "@admitstory/db";
import { checkRateLimit, handle, requireUser } from "@/lib/api";
import { profileReadRequested } from "@/inngest/events";
import { runProfileRead } from "@/lib/profile-read/server";
import { dispatch } from "@/lib/strategy/dispatch";
import { STRATEGY_LIMITS } from "@/lib/strategy/page-data";

// POST /api/profile/read/refresh (spec §11, §5.4 "unless the user asks"): queues a rebuild of the
// caller's Profile Read. Rate-limited; repeating it is harmless (one build per user at a time).
// Returns the version on screen now, so the page can wait for a newer one.

export async function POST(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("profileReadRefresh", userId, STRATEGY_LIMITS.profileReadRefresh);
    const latest = await getLatestProfileRead(getDb(), userId);
    await dispatch(profileReadRequested.create({ userId, reason: "manual" }), () =>
      runProfileRead(userId, "manual"),
    );
    return Response.json(
      { requested: true, currentVersion: latest?.version ?? null },
      { status: 202 },
    );
  });
}
