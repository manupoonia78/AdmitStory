import { getDb, updateDraftState } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";
import { draftContext } from "@/lib/workspace/server";

// GET /api/drafts/:id (spec §11). PATCH sets paragraph locks (key L) or dismisses the stale flag;
// content never changes in place (that is a new version, POST /save).

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const { draft } = await draftContext(
      session.user.id,
      await idParam(context, "id", "That draft"),
    );
    return Response.json({ draft });
  });
}

const Patch = z.strictObject({
  lockedParagraphs: z.array(z.string().min(1).max(100)).max(30).optional(),
  stale: z.literal(false).optional(),
});

export async function PATCH(request: Request, context: Ctx): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("workspaceWrites", session.user.id, WORKSPACE_WRITE_LIMIT);
    const { draft } = await draftContext(
      session.user.id,
      await idParam(context, "id", "That draft"),
    );
    const body = await readJson(request, Patch);
    const ids = new Set(draft.content.paragraphs.map((p) => p.id));
    const row = await updateDraftState(getDb(), session.user.id, draft.id, {
      ...(body.lockedParagraphs
        ? { lockedParagraphs: body.lockedParagraphs.filter((id) => ids.has(id)) }
        : {}),
      ...(body.stale === false ? { stale: false } : {}),
    });
    return Response.json({ draft: row });
  });
}
