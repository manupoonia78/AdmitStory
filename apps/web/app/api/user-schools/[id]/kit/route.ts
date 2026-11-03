import { getDb, getKitForUserSchool, getUserSchool } from "@admitstory/db";
import { z } from "zod";
import { handle, notFound, requireUser } from "@/lib/api";

// GET /api/user-schools/:id/kit: the full kit for one of the caller's schools, once payment has
// created it. The unlock page polls this after checkout until the webhook has landed.

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = z.guid().safeParse((await context.params).id);
    if (!id.success) notFound("That school");
    const db = getDb();
    const row = await getUserSchool(db, session.user.id, id.data);
    if (!row) notFound("That school");
    const kit = await getKitForUserSchool(db, session.user.id, row.id);
    return Response.json(
      kit && kit.status !== "preview" ? { kitId: kit.id, status: kit.status } : { kitId: null },
    );
  });
}
