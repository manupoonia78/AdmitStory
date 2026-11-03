import { getDb, getFormAdvice, setFormEdit } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { entryKey } from "@/lib/forms/advise";
import { formKitContext } from "@/lib/forms/view";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";

// PATCH /api/kits/:id/forms/items/:itemId (spec §11, §5.10): the applicant's own text for one form
// entry, saved as they type. Null puts the advice's entry back. Their text is never overwritten by
// a refresh of the advice.

const Body = z.strictObject({
  section: z.string().trim().min(1).max(120),
  text: z.string().max(10_000).nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("workspaceWrites", userId, WORKSPACE_WRITE_LIMIT);
    const kit = await formKitContext(userId, await idParam(context, "id", "That kit"));
    const itemId = z
      .string()
      .regex(/^[a-z0-9_-]{1,40}$/i)
      .safeParse((await context.params).itemId);
    if (!itemId.success) notFound("That entry");
    const { section, text } = await readJson(request, Body);
    const db = getDb();
    const advice = await getFormAdvice(db, userId, kit.kit.id);
    const exists = advice?.content.sections
      .find((s) => s.section_key === section)
      ?.items.some((i) => i.id === itemId.data);
    if (!exists) notFound("That entry");
    const row = await setFormEdit(db, userId, kit.kit.id, entryKey(section, itemId.data), text);
    if (!row) notFound("That entry");
    return Response.json({ saved: true });
  });
}
