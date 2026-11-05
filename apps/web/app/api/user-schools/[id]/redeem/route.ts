import { z } from "zod";
import { checkRateLimit, handle, notFound, requireUser } from "@/lib/api";
import { assertFeatureOn } from "@/lib/features";
import { redeemCredit } from "@/lib/payments/server";

// POST /api/user-schools/:id/redeem: unlocks one of the caller's schools with a credit from a pack
// they bought (Manu, 5 Nov 2026) and starts its kit. No payment: the pack was paid for once.

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("checkout", userId, { limit: 10, windowMs: 60_000 });
    await assertFeatureOn("kit_checkout");
    const id = z.guid().safeParse((await context.params).id);
    if (!id.success) notFound("That school");
    return Response.json(await redeemCredit(userId, id.data), { status: 201 });
  });
}
