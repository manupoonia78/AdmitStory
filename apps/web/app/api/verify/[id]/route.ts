import { getDb, resolveVerifyItem, VerifyResolution } from "@admitstory/db";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";

// PATCH /api/verify/:id (spec §11, §5.8 Verify): confirm a claim, or correct it.

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("workspaceWrites", session.user.id, WORKSPACE_WRITE_LIMIT);
    const id = await idParam(context, "id", "That item");
    const body = await readJson(request, VerifyResolution);
    const item = await resolveVerifyItem(getDb(), session.user.id, id, body);
    if (!item) notFound("That item");
    return Response.json({ item });
  });
}
