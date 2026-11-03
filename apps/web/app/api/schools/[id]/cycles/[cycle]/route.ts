import { getDb } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, notFound, requireUser } from "@/lib/api";
import { STRATEGY_LIMITS } from "@/lib/strategy/page-data";
import { loadApplicant, schoolCycleDetail } from "@/lib/strategy/server";

// GET /api/schools/:id/cycles/:cycle (spec §11): one school-cycle with its verified rounds,
// prompts, interview format and AI policy, each with its source. Unpublished cycles return
// "Pack coming soon" and nothing else (§5.5: nothing unverified is shown).

const Params = z.object({ id: z.guid(), cycle: z.string().regex(/^\d{4}-\d{2}$/) });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; cycle: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("schoolSearch", userId, STRATEGY_LIMITS.search);
    const params = Params.safeParse(await context.params);
    if (!params.success) notFound("That school cycle");
    const applicant = await loadApplicant(userId);
    const detail = await schoolCycleDetail(
      getDb(),
      params.data.id,
      params.data.cycle,
      userId,
      applicant.timeZone,
    );
    if (!detail) notFound("That school cycle");
    return Response.json({ ...detail, timeZone: applicant.timeZone });
  });
}
