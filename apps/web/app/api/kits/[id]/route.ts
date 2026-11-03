import { z } from "zod";
import { handle, notFound, requireUser } from "@/lib/api";
import { loadKitView } from "@/lib/kit/view";

// GET /api/kits/:id (spec §11): the kit as screen F shows it. Scoped to the caller.

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = z.guid().safeParse((await context.params).id);
    if (!id.success) notFound("That kit");
    const view = await loadKitView(session.user.id, id.data);
    if (!view || view.status === "preview") notFound("That kit");
    return Response.json(view);
  });
}
