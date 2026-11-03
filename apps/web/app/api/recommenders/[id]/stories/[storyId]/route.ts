import { deleteLorStory, getDb, listLorStories, updateLorStory } from "@admitstory/db";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import {
  LorStoryFieldsBody,
  RECOMMENDER_WRITE_LIMIT,
  ownRecommender,
} from "@/lib/recommenders/route";
import { idParam } from "@/lib/workspace/route";

// PATCH / DELETE /api/recommenders/:id/stories/:storyId (spec §5.11): the applicant's corrections.
// An extracted story the applicant edits becomes theirs ("edited") and survives the next
// extraction, so a correction is never overwritten by the model.

const Body = LorStoryFieldsBody.partial();

/** The story must belong to the caller and to this recommender. */
async function ownStory(userId: string, recommenderId: string, storyId: string) {
  const rows = await listLorStories(getDb(), userId, { recommenderId });
  const row = rows.find((candidate) => candidate.id === storyId);
  if (!row) notFound("That story");
  return row;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; storyId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderWrites", userId, RECOMMENDER_WRITE_LIMIT);
    const recommender = await ownRecommender(
      userId,
      await idParam(context, "id", "That recommender"),
    );
    const storyId = await idParam(context, "storyId", "That story");
    await ownStory(userId, recommender.id, storyId);
    const row = await updateLorStory(getDb(), userId, storyId, await readJson(request, Body));
    if (!row) notFound("That story");
    return Response.json({ ...row.fields, id: row.id, code: row.code, origin: row.origin });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; storyId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderWrites", userId, RECOMMENDER_WRITE_LIMIT);
    const recommender = await ownRecommender(
      userId,
      await idParam(context, "id", "That recommender"),
    );
    const storyId = await idParam(context, "storyId", "That story");
    await ownStory(userId, recommender.id, storyId);
    if (!(await deleteLorStory(getDb(), userId, storyId))) notFound("That story");
    return Response.json({ deleted: true });
  });
}
