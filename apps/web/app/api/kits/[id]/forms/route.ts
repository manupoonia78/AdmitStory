import { getDb, getDeliverable } from "@admitstory/db";
import { z } from "zod";
import { handle, notFound, requireUser } from "@/lib/api";
import { formViewFor, formKitContext } from "@/lib/forms/view";
import { idParam } from "@/lib/workspace/route";

// GET /api/kits/:id/forms?deliverable=<id> (spec §11, §5.10): the Form Advisor's view of one form
// section. Kits built before Phase 5 get their advice written on this first read.

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    const kit = await formKitContext(userId, await idParam(context, "id", "That kit"));
    const id = z.guid().safeParse(new URL(request.url).searchParams.get("deliverable"));
    if (!id.success) notFound("That form");
    const deliverable = await getDeliverable(getDb(), userId, id.data);
    if (!deliverable || deliverable.kitId !== kit.kit.id || deliverable.type !== "form_section")
      notFound("That form");
    return Response.json(await formViewFor(userId, kit, deliverable));
  });
}
