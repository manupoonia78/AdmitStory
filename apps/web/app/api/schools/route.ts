import { getDb, searchSchools } from "@admitstory/db";
import { checkRateLimit, handle, requireUser } from "@/lib/api";
import { loadApplicant, schoolCards } from "@/lib/strategy/server";
import { STRATEGY_LIMITS } from "@/lib/strategy/page-data";

// GET /api/schools?q= (spec §11, §5.5 "Add schools"): search by name. Each result carries the
// current cycle's verified rounds (deadlines in the caller's time zone), essays, interview format,
// verified AI policy and pack freshness, every one with its source; a school without a published
// pack comes back as "Pack coming soon" with none of them.

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("schoolSearch", userId, STRATEGY_LIMITS.search);
    const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200);
    const db = getDb();
    const [summaries, applicant] = await Promise.all([
      searchSchools(db, q, { limit: 12 }),
      loadApplicant(userId),
    ]);
    const schools = await schoolCards(db, summaries, userId, applicant.timeZone);
    return Response.json({ schools, timeZone: applicant.timeZone });
  });
}
