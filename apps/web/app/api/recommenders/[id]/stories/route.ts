import { createManualLorStory, getDb } from "@admitstory/db";
import { z } from "zod";
import { ai } from "@/lib/ai";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { withIdempotency } from "@/lib/idempotency";
import {
  IntakeAnswersBody,
  LorStoryFieldsBody,
  RECOMMENDER_AI_LIMIT,
  ownRecommender,
} from "@/lib/recommenders/route";
import { saveIntakeAnswers } from "@/lib/recommenders/stories";
import { loadRecommenderDetail } from "@/lib/recommenders/view";

// POST /api/recommenders/:id/stories (spec §5.11, §11): the intake answers, which are stored and
// then read by `lor.extract`, or one story the applicant wrote themselves.
//
// Idempotent on the key, so a resent intake never pays for a second extraction.

const Body = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("intake"), answers: IntakeAnswersBody }),
  z.strictObject({ kind: z.literal("manual"), story: LorStoryFieldsBody }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    const { id } = await context.params;
    const recommender = await ownRecommender(userId, id);
    const body = await readJson(request, Body);
    const db = getDb();

    if (body.kind === "manual") {
      const row = await createManualLorStory(db, userId, recommender.id, body.story);
      if (!row) notFound("That recommender");
      return Response.json(await loadRecommenderDetail(userId, recommender.id), { status: 201 });
    }

    await checkRateLimit("recommenderExtract", userId, RECOMMENDER_AI_LIMIT);
    return withIdempotency(request, "recommenders.stories", userId, async () => {
      await saveIntakeAnswers({ ai: ai(), db }, userId, recommender.id, body.answers);
      return { status: 201, body: await loadRecommenderDetail(userId, recommender.id) };
    });
  });
}
