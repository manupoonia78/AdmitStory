import {
  beginKitRegeneration,
  getDb,
  getKit,
  listDeliverables,
  setKitStatus,
} from "@admitstory/db";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { kitGenerate } from "@/inngest/events";
import { runKitGeneration } from "@/lib/kit/run";
import { dispatch } from "@/lib/strategy/dispatch";

// POST /api/kits/:id/regenerate (spec §11, §5.6, §5.7): with `only`, retries the named deliverables
// that didn't finish ("Try Essay 2 again?") at no cost to the allowance; without it, the one
// whole-kit regeneration the entitlement includes.

const Body = z.strictObject({ only: z.array(z.guid()).min(1).max(40).optional() });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("kitRegenerate", userId, { limit: 5, windowMs: 60_000 });
    const id = z.guid().safeParse((await context.params).id);
    if (!id.success) notFound("That kit");
    const db = getDb();
    const kit = await getKit(db, userId, id.data);
    if (!kit || kit.status === "preview") notFound("That kit");
    const body = await readJson(request, Body);

    if (body.only) {
      if (kit.status === "pending" || kit.status === "running")
        throw new ApiError(409, "Your kit is still being built. Try again when it finishes.");
      const mine = new Set(((await listDeliverables(db, userId, kit.id)) ?? []).map((d) => d.id));
      if (!body.only.every((d) => mine.has(d))) notFound("That essay");
      await setKitStatus(db, userId, kit.id, "pending");
    } else {
      const started = await beginKitRegeneration(db, userId, kit.id);
      if (!started.ok)
        throw new ApiError(
          started.reason === "not_found" ? 404 : 409,
          started.reason === "busy"
            ? "Your kit is still being built. Try again when it finishes."
            : started.reason === "limit_reached"
              ? "You've used this kit's regeneration."
              : "This kit can't be regenerated.",
        );
    }
    const ref = { kitId: kit.id, userId, ...(body.only ? { only: body.only } : {}) };
    await dispatch(kitGenerate.create(ref), () => runKitGeneration(ref));
    return Response.json({ started: true }, { status: 202 });
  });
}
