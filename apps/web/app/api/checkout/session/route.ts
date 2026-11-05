import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { assertFeatureOn } from "@/lib/features";
import { withIdempotency } from "@/lib/idempotency";
import { openSchoolCheckout } from "@/lib/payments/server";

// POST /api/checkout/session (spec §11, §5.6): opens a checkout for one school on the caller's list,
// or for a 5- or 10-school pack starting with it, and returns what the browser needs to show it. The price and product come from the server, never
// the client. An Idempotency-Key header makes a double click return the same checkout.

const Body = z.strictObject({
  userSchoolId: z.guid(),
  plan: z.enum(["school_kit", "school_pack5", "school_pack10"]).default("school_kit"),
  discountCode: z.string().trim().min(1).max(40).optional(),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const userId = user.session.user.id;
    await checkRateLimit("checkout", userId, { limit: 10, windowMs: 60_000 });
    await assertFeatureOn("kit_checkout");
    const body = await readJson(request, Body);
    return withIdempotency(request, "checkout.session", userId, async () => ({
      status: 201,
      body: await openSchoolCheckout(
        { id: userId, email: user.session.user.email },
        body.userSchoolId,
        { plan: body.plan, ...(body.discountCode ? { discountCode: body.discountCode } : {}) },
      ),
    }));
  });
}
