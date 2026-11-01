import { applyPatches } from "@admitstory/ai";
import { getDb, setCheckStatus } from "@admitstory/db";
import { Patch } from "@admitstory/shared/schemas";
import type { Paragraph } from "@admitstory/shared/kit";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";
import { draftContext, saveUserEdits } from "@/lib/workspace/server";

// PATCH /api/checks/:id (spec §11, §5.8 Checks): dismiss a finding, or apply its one-click fix (a
// safe mechanical patch). A fix never touches a locked paragraph.

const Body = z.strictObject({ action: z.enum(["dismiss", "fix", "reopen"]) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("workspaceWrites", userId, WORKSPACE_WRITE_LIMIT);
    const id = await idParam(context, "id", "That check");
    const { action } = await readJson(request, Body);
    const db = getDb();
    if (action !== "fix") {
      const row = await setCheckStatus(db, userId, id, action === "dismiss" ? "dismissed" : "open");
      if (!row) notFound("That check");
      return Response.json({ check: row });
    }
    const check = await setCheckStatus(db, userId, id, "fixed");
    if (!check) notFound("That check");
    const ctx = await draftContext(userId, check.draftId);
    const patch = Patch.safeParse(check.patch);
    if (!patch.success) throw new ApiError(409, "This check has no automatic fix.");
    if (ctx.draft.lockedParagraphs.includes(patch.data.paragraph_id))
      throw new ApiError(409, "That paragraph is locked. Unlock it to apply the fix.");
    const paragraphs = applyPatches(
      ctx.draft.content.paragraphs as Paragraph[],
      [patch.data],
      () => `p${Date.now()}`,
    );
    return Response.json(await saveUserEdits(userId, ctx, paragraphs));
  });
}
