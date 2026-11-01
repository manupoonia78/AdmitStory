import { StoryPatch, getDb, getStory, listGoldenLines, updateStory } from "@admitstory/db";
import { queueStaleCheck } from "@/lib/kit/dispatch";
import { STORY_CONTENT_FIELDS, touchesContent } from "@/lib/kit/stale";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";

// GET/PATCH /api/dossier/stories/:id (spec §11). Every field on a story card is the applicant's to
// change, including consent and sensitivity: whether a story may be used is their decision alone
// (§14.3).

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const { id } = await context.params;
    const db = getDb();
    const story = await getStory(db, session.user.id, id);
    if (!story) notFound("That story");
    const lines = await listGoldenLines(db, session.user.id, id);
    return Response.json({ story, lines });
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const { id } = await context.params;
    const patch = await readJson(request, StoryPatch);
    const story = await updateStory(getDb(), session.user.id, id, patch);
    if (!story) notFound("That story");
    if (touchesContent(patch, STORY_CONTENT_FIELDS))
      await queueStaleCheck({
        userId: session.user.id,
        storyCodes: [story.code],
        reason: `Your story "${story.nickname}" changed`,
      });
    return Response.json({ story });
  });
}
