import { getDb, setResumeOrder } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { ownResumeReview } from "@/lib/forms/resume-view";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";

// PATCH /api/resume/review/:id (spec §5.10): whether the export uses the suggested section order.

const Body = z.strictObject({ useSuggestedOrder: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("workspaceWrites", userId, WORKSPACE_WRITE_LIMIT);
    const review = await ownResumeReview(userId, await idParam(context, "id", "That review"));
    const { useSuggestedOrder } = await readJson(request, Body);
    const row = await setResumeOrder(getDb(), userId, review.id, useSuggestedOrder);
    if (!row) notFound("That review");
    return Response.json({ useSuggestedOrder: row.useSuggestedOrder });
  });
}
