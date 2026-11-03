import { getDb, restoreDraftVersion } from "@admitstory/db";
import { handle, requireUser } from "@/lib/api";
import { idParam } from "@/lib/workspace/route";
import { draftContext } from "@/lib/workspace/server";

// POST /api/drafts/:id/restore (spec §11, §5.8): makes an earlier version current again, as a new
// version, so nothing is lost.

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const { draft } = await draftContext(
      session.user.id,
      await idParam(context, "id", "That draft"),
    );
    return Response.json({ draft: await restoreDraftVersion(getDb(), session.user.id, draft.id) });
  });
}
