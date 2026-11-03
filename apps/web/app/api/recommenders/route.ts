import { createRecommender, getAccountIdentity, getDb, NewRecommender } from "@admitstory/db";
import { ApiError, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { withIdempotency } from "@/lib/idempotency";
import { RECOMMENDER_WRITE_LIMIT } from "@/lib/recommenders/route";
import { loadRecommenderDetail, loadRecommendersPage } from "@/lib/recommenders/view";

// GET /api/recommenders: screen H's view. POST: adds a recommender (spec §5.11, §11).
//
// The applicant may not add their own address (decision 7): the portal link goes to that address,
// and the applicant must never be able to open the portal and read what a recommender wrote.

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    return Response.json(await loadRecommendersPage(session.user.id));
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderWrites", userId, RECOMMENDER_WRITE_LIMIT);
    const body = await readJson(request, NewRecommender);
    const account = await getAccountIdentity(getDb(), userId);
    if (account && body.email.trim().toLowerCase() === account.email.toLowerCase())
      throw new ApiError(
        422,
        "That's your own address. A recommender's page is private to them, so it has to be theirs.",
      );
    return withIdempotency(request, "recommenders.create", userId, async () => {
      const row = await createRecommender(getDb(), userId, body);
      return { status: 201, body: await loadRecommenderDetail(userId, row.id) };
    });
  });
}
