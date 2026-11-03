import { getDb } from "@admitstory/db";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { RECOMMENDER_WRITE_LIMIT, ownRecommender } from "@/lib/recommenders/route";
import { patchReminder } from "@/lib/reminders/schedule";
import { idParam } from "@/lib/workspace/route";

// PATCH /api/recommenders/:id/reminders/:reminderId (decision 3): "Read it", "Turn on", "Turn
// off", and the applicant's own line in the email.
//
// Turning one on carries the hash of the text just read; a hash that no longer matches is a 409,
// because the words have moved since. Writing a note moves them too, so it clears the read.

const Body = z
  .strictObject({
    previewed: z.string().trim().length(64).optional(),
    on: z.boolean().optional(),
    previewHash: z.string().trim().length(64).optional(),
    note: z.string().trim().max(300).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change." });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; reminderId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderWrites", userId, RECOMMENDER_WRITE_LIMIT);
    const recommender = await ownRecommender(
      userId,
      await idParam(context, "id", "That recommender"),
    );
    const reminderId = await idParam(context, "reminderId", "That reminder");
    const patch = await readJson(request, Body);
    const outcome = await patchReminder(getDb(), userId, recommender.id, reminderId, patch);
    if (outcome.ok) return Response.json(outcome.view);
    if (outcome.reason === "not_found") notFound("That reminder");
    throw new ApiError(
      409,
      outcome.reason === "stale"
        ? "This email has changed since you read it. Read it once more, then turn it on."
        : "That reminder has already gone out.",
    );
  });
}
