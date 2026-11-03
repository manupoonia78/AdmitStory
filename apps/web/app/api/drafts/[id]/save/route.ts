import { Paragraph } from "@admitstory/shared/schemas";
import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";
import { draftContext, saveUserEdits } from "@/lib/workspace/server";

// POST /api/drafts/:id/save (spec §11, §5.8): the applicant's own edits as a new version. Edited
// paragraphs are theirs from now on: the AI never overwrites them without a diff to accept.

const Body = z.strictObject({
  paragraphs: z.array(Paragraph).min(1).max(30),
  lockedParagraphs: z.array(z.string().min(1).max(100)).max(30).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("workspaceWrites", session.user.id, WORKSPACE_WRITE_LIMIT);
    const ctx = await draftContext(session.user.id, await idParam(context, "id", "That draft"));
    const body = await readJson(request, Body);
    const saved = await saveUserEdits(session.user.id, ctx, body.paragraphs, body.lockedParagraphs);
    return Response.json(saved);
  });
}
