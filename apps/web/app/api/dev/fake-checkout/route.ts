import { buildSignedFakeWebhook, parseProductKey, type ProductKey } from "@admitstory/payments";
import { z } from "zod";
import { getCheckout, getDb } from "@admitstory/db";
import { ApiError, handle, notFound, readJson, requireUser } from "@/lib/api";
import { isLocalAppUrl, serverEnv } from "@/lib/env";
import { payments, processWebhook } from "@/lib/payments/server";

// POST /api/dev/fake-checkout (localhost only): the local checkout's "Pay $100 (test)". Builds the
// webhook Paddle would send for the caller's own open checkout, signed the way Paddle signs, and
// hands it to the same handler the real webhook route uses. Refuses anywhere but localhost, and
// whenever the real provider is configured.

const Body = z.strictObject({
  transactionId: z.string().trim().min(1).max(200),
  outcome: z.enum(["paid", "declined"]).default("paid"),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    if (!isLocalAppUrl(serverEnv().APP_URL) || payments().name !== "fake")
      throw new ApiError(404, "Not available.");
    const { session } = await requireUser();
    const body = await readJson(request, Body);
    const checkout = await getCheckout(getDb(), session.user.id, body.transactionId);
    if (!checkout) notFound("That checkout");
    if (!parseProductKey(checkout.productKey)) notFound("That checkout");
    const webhook = buildSignedFakeWebhook(
      body.outcome === "paid"
        ? {
            type: "purchase_completed",
            transactionId: checkout.providerCheckoutId,
            userId: session.user.id,
            productKey: checkout.productKey as ProductKey,
            amountCents: checkout.amountCents,
            currency: checkout.currency,
          }
        : {
            type: "payment_failed",
            transactionId: checkout.providerCheckoutId,
            userId: session.user.id,
            productKey: checkout.productKey as ProductKey,
            currency: checkout.currency,
            errorCode: "declined",
          },
    );
    const result = await processWebhook(webhook.body, webhook.headers);
    return Response.json(result.body, { status: result.status });
  });
}
