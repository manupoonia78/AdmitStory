import { getDb } from "@admitstory/db";
import { COMMON_GROUP_KEY } from "@admitstory/shared/kit";
import { z } from "zod";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { withIdempotency } from "@/lib/idempotency";
import { requestBriefs } from "@/lib/recommenders/briefs";
import { RECOMMENDER_AI_LIMIT, ownRecommender } from "@/lib/recommenders/route";
import { loadBriefView } from "@/lib/recommenders/view";
import { idParam } from "@/lib/workspace/route";

// GET /api/recommenders/:id/brief?group=: one brief for screen H's Brief tab.
// POST: builds this recommender's briefs (spec §5.11, decision 19 for what a rebuild costs).
//
// The brief holds talking points, never letter prose: that rule lives in the task's checks, and
// nothing here can add a field for it.

const Body = z.strictObject({ groupKey: z.string().trim().max(80).optional() });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    const id = await idParam(context, "id", "That recommender");
    const group = new URL(request.url).searchParams.get("group") ?? COMMON_GROUP_KEY;
    const view = await loadBriefView(userId, id, group);
    if (!view) notFound("That brief");
    return Response.json(view);
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderBriefs", userId, RECOMMENDER_AI_LIMIT);
    const recommender = await ownRecommender(
      userId,
      await idParam(context, "id", "That recommender"),
    );
    const { groupKey } = await readJson(request, Body);
    return withIdempotency(request, "recommenders.brief", userId, async () => ({
      status: 202,
      body: await requestBriefs(getDb(), userId, recommender.id, { groupKey, reason: "applicant" }),
    }));
  });
}
