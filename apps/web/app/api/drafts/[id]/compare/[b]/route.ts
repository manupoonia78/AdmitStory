import { getDb, getDraftPair } from "@admitstory/db";
import { handle, notFound, requireUser } from "@/lib/api";
import { idParam } from "@/lib/workspace/route";
import { draftContext } from "@/lib/workspace/server";

// GET /api/drafts/:a/compare/:b (spec §11): two versions of the same deliverable, for the diff.

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; b: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const a = await draftContext(session.user.id, await idParam(context, "id", "That draft"));
    const pair = await getDraftPair(
      getDb(),
      session.user.id,
      a.draft.id,
      await idParam(context, "b", "That draft"),
    );
    if (!pair || pair.b.deliverableId !== a.draft.deliverableId) notFound("That draft");
    return Response.json({
      a: {
        id: pair.a.id,
        version: pair.a.version,
        text: pair.a.plainText,
        paragraphs: pair.a.content.paragraphs,
      },
      b: {
        id: pair.b.id,
        version: pair.b.version,
        text: pair.b.plainText,
        paragraphs: pair.b.content.paragraphs,
      },
    });
  });
}
