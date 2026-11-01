import { getDb, listAngles } from "@admitstory/db";
import { checkRateLimit, handle, notFound, requireUser } from "@/lib/api";
import { kitDraftOption } from "@/inngest/events";
import { ai } from "@/lib/ai";
import { draftOption } from "@/lib/kit/options";
import { dispatch } from "@/lib/strategy/dispatch";
import { idParam, REFINE_LIMIT } from "@/lib/workspace/route";
import { deliverableContext } from "@/lib/workspace/server";

// POST /api/deliverables/:id/angles/:angleId/draft (spec §11, §5.7 stage 6): "Draft this option".
// Runs in the background; the Options tab shows the new draft when it lands.

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; angleId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("draftOption", userId, REFINE_LIMIT);
    const id = await idParam(context, "id", "That deliverable");
    const angleId = await idParam(context, "angleId", "That option");
    const { deliverable } = await deliverableContext(userId, id);
    const angles = await listAngles(getDb(), userId, deliverable.id);
    if (!angles.some((a) => a.id === angleId)) notFound("That option");
    await dispatch(kitDraftOption.create({ userId, deliverableId: id, angleId }), async () => {
      await draftOption({ ai: ai(), db: getDb() }, userId, deliverable, angleId);
      await ai().flush();
    });
    return Response.json({ drafting: angleId }, { status: 202 });
  });
}
