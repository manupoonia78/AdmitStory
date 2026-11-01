import { getDb, updateDeliverable } from "@admitstory/db";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { allowedMode, authorshipFor, type AiStance } from "@/lib/kit/authorship";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";
import { deliverableContext, policyFor } from "@/lib/workspace/server";
import { loadWorkspaceView } from "@/lib/workspace/view";

// GET /api/deliverables/:id (spec §11): the Workspace for one deliverable. PATCH changes its
// authorship mode, only ever to a stricter one than the school's policy allows (§14.2).

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = await idParam(context, "id", "That deliverable");
    return Response.json(await loadWorkspaceView(session.user.id, id));
  });
}

const Patch = z.strictObject({ authorshipMode: z.enum(["draft", "coach", "talking_points"]) });

export async function PATCH(request: Request, context: Ctx): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("workspaceWrites", session.user.id, WORKSPACE_WRITE_LIMIT);
    const id = await idParam(context, "id", "That deliverable");
    const { deliverable, kit } = await deliverableContext(session.user.id, id);
    const body = await readJson(request, Patch);
    const stance = ((await policyFor(kit))?.stance ?? "unknown") as AiStance;
    if (!allowedMode(authorshipFor(deliverable.type, stance), body.authorshipMode))
      throw new ApiError(409, `${kit.school.name}'s AI policy doesn't allow that mode.`);
    const row = await updateDeliverable(getDb(), session.user.id, id, body);
    return Response.json({ deliverable: row });
  });
}
