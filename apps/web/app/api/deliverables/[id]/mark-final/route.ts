import {
  getCurrentDraft,
  getDb,
  listChecks,
  listVerifyItems,
  markDraftFinal,
} from "@admitstory/db";
import { z } from "zod";
import { ApiError, handle, readJson, requireUser } from "@/lib/api";
import { idParam } from "@/lib/workspace/route";
import { deliverableContext } from "@/lib/workspace/server";

// POST /api/deliverables/:id/mark-final (spec §11, §5.8): marks the current draft final, or not.
// Open must-fix checks and Verify items don't block it; they're returned so the page can show them.

const Body = z.strictObject({ final: z.boolean().default(true) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    const id = await idParam(context, "id", "That deliverable");
    const { kit } = await deliverableContext(userId, id);
    const { final } = await readJson(request, Body);
    const db = getDb();
    const draft = await getCurrentDraft(db, userId, id);
    if (!draft) throw new ApiError(409, "There's no draft to mark final yet.");
    const [checks, verify] = await Promise.all([
      listChecks(db, userId, draft.id),
      listVerifyItems(db, userId, kit.kit.id, { deliverableId: id, status: "open" }),
    ]);
    const marked = await markDraftFinal(db, userId, draft.id, final);
    return Response.json({
      draft: marked,
      open: {
        mustFix: checks.filter((c) => c.status === "open" && c.severity === "must").length,
        verify: verify.length,
      },
    });
  });
}
