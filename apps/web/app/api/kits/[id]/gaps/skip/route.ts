import { getDb, getKit } from "@admitstory/db";
import { z } from "zod";
import { handle, notFound, requireUser } from "@/lib/api";
import { kitGapsAnswered } from "@/inngest/events";
import { dispatch } from "@/lib/strategy/dispatch";

// POST /api/kits/:id/gaps/skip (spec §5.7 stage 4 "Skip, draft with gaps"): drafting starts now;
// the open questions stay as NEED chips in the drafts, to answer later.

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = z.guid().safeParse((await context.params).id);
    if (!id.success) notFound("That kit");
    const kit = await getKit(getDb(), session.user.id, id.data);
    if (!kit || kit.status === "preview") notFound("That kit");
    await dispatch(
      kitGapsAnswered.create({ kitId: kit.id, userId: session.user.id, skipped: true }),
      async () => {},
    );
    return Response.json({ skipped: true }, { status: 202 });
  });
}
