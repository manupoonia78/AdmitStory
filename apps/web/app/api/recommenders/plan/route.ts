import { getDb } from "@admitstory/db";
import { z } from "zod";
import { ai } from "@/lib/ai";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { ensurePlan } from "@/lib/recommenders/briefs";
import { RECOMMENDER_PLAN_LIMIT } from "@/lib/recommenders/route";
import { loadCoverageView } from "@/lib/recommenders/view";

// POST /api/recommenders/plan: writes the coverage plan again across every recommender ("Rebuild
// the plan"). Free (decision 19), so the rate limit is what keeps it honest. Answers with the
// Coverage tab's view, whose findings are recomputed deterministically on read.

const Body = z.strictObject({});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderPlan", userId, RECOMMENDER_PLAN_LIMIT);
    await readJson(request, Body);
    await ensurePlan({ ai: ai(), db: getDb() }, userId, { force: true });
    return Response.json(await loadCoverageView(userId));
  });
}
