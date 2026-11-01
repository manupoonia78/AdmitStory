import { getDb, getDraft, setCurrentDraft } from "@admitstory/db";
import { z } from "zod";
import { handle, notFound, readJson, requireUser } from "@/lib/api";
import { idParam } from "@/lib/workspace/route";
import { deliverableContext } from "@/lib/workspace/server";

// POST /api/deliverables/:id/use-option (spec §5.8 Options): "Use this option" makes an option's
// draft the current one. The previous draft stays in the version history.

const Body = z.strictObject({ draftId: z.guid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = await idParam(context, "id", "That deliverable");
    await deliverableContext(session.user.id, id);
    const { draftId } = await readJson(request, Body);
    const db = getDb();
    const draft = await getDraft(db, session.user.id, draftId);
    if (!draft || draft.deliverableId !== id) notFound("That draft");
    return Response.json({ draft: await setCurrentDraft(db, session.user.id, draftId) });
  });
}
