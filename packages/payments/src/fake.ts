import { createHash } from "node:crypto";
import { checkCheckoutInput, refundBody } from "./dodo";
import { isLocalUrl } from "./env";
import { mapDodoEvent } from "./events";
import {
  parseProductKey,
  PaymentsConfigError,
  type CheckoutInput,
  type PaymentsProvider,
  type ProductKey,
  type RefundResult,
} from "./provider";
import { signatureHeaders, verifySignedWebhook } from "./signature";

// The development payments provider, chosen when Dodo isn't configured and APP_URL is localhost.
// The app renders its own local overlay for a "fake" checkout; when the buyer confirms, it asks
// this provider for a Dodo-shaped webhook signed with the same scheme Dodo uses and posts it to
// its own webhook handler. So the signature check, payload validation, event mapping and purchase
// idempotency all run exactly as they will in production. Ids are derived from their inputs and
// the clock (deterministic under a fixed `now`).

/** Not a secret: it only ever verifies webhooks the fake itself signed, on localhost. */
export const FAKE_WEBHOOK_SECRET = `whsec_${Buffer.from(
  "fake_dodo_webhook_secret_localhost_only",
).toString("base64")}`;

export const fakeId = (prefix: string, ...parts: (string | number)[]): string =>
  `${prefix}_${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 26)}`;

/** The payment a fake checkout session turns into. */
export const fakePaymentId = (checkoutId: string): string => fakeId("pay", checkoutId);

export type FakeWebhookEvent =
  | {
      type: "purchase_completed";
      /** The checkout session (`cks_…`) the checkout row was recorded under. */
      checkoutId: string;
      userId: string;
      productKey: ProductKey;
      amountCents: number;
      currency: string;
      discountId?: string | null;
    }
  | {
      type: "refund_completed";
      paymentId: string;
      refundId: string;
      amountCents: number;
      currency: string;
      partial?: boolean;
    }
  | {
      type: "payment_failed";
      checkoutId: string;
      userId: string;
      productKey: ProductKey;
      currency: string;
      errorCode?: string;
    };

export interface SignedWebhook {
  body: string;
  headers: Record<string, string>;
}

/** A Dodo-shaped webhook for `event`, signed as Dodo signs (Standard Webhooks). */
export function buildSignedFakeWebhook(
  event: FakeWebhookEvent,
  { secret = FAKE_WEBHOOK_SECRET, now = Date.now }: { secret?: string; now?: () => number } = {},
): SignedWebhook {
  const at = now();
  const timestamp = new Date(at).toISOString();
  let type: string;
  let data: Record<string, unknown>;
  let key: string;

  if (event.type === "refund_completed") {
    type = "refund.succeeded";
    key = event.refundId;
    data = {
      payload_type: "Refund",
      refund_id: event.refundId,
      payment_id: event.paymentId,
      status: "succeeded",
      is_partial: event.partial ?? false,
      amount: event.amountCents,
      currency: event.currency,
      reason: "requested_by_customer",
      metadata: {},
      created_at: timestamp,
    };
  } else {
    const product = parseProductKey(event.productKey);
    if (!product) throw new PaymentsConfigError(`Unknown product key "${event.productKey}".`);
    const completed = event.type === "purchase_completed";
    type = completed ? "payment.succeeded" : "payment.failed";
    key = event.checkoutId;
    data = {
      payload_type: "Payment",
      payment_id: fakePaymentId(event.checkoutId),
      checkout_session_id: event.checkoutId,
      status: completed ? "succeeded" : "failed",
      total_amount: completed ? event.amountCents : 0,
      currency: event.currency,
      customer: { customer_id: fakeId("cus", event.userId) },
      discount_id: completed ? (event.discountId ?? null) : null,
      metadata: {
        user_id: event.userId,
        school_cycle_id: product.schoolCycleId,
        product_key: event.productKey,
      },
      error_code: completed ? null : (event.errorCode ?? "CARD_DECLINED"),
      created_at: timestamp,
    };
  }

  const body = JSON.stringify({ business_id: "bus_fake", type, timestamp, data });
  return {
    body,
    headers: {
      "content-type": "application/json",
      ...signatureHeaders(secret, fakeId("msg", type, key), body, Math.floor(at / 1000)),
    },
  };
}

export interface FakePaymentsProvider extends PaymentsProvider {
  name: "fake";
  /** The signed webhook for a checkout this provider created: what Dodo sends after payment. */
  completeCheckout(checkoutId: string, outcome?: "paid" | "declined"): SignedWebhook;
  /** The signed webhook for a refund this provider created. */
  refundWebhook(refundId: string): SignedWebhook;
}

export function createFakePayments({
  appUrl,
  now = Date.now,
  secret = FAKE_WEBHOOK_SECRET,
}: {
  appUrl: string | undefined;
  now?: () => number;
  secret?: string;
}): FakePaymentsProvider {
  // A deployed app without Dodo keys must say checkout is unavailable, not grant kits for free.
  if (!isLocalUrl(appUrl))
    throw new PaymentsConfigError(
      "The fake payments provider runs only when APP_URL is localhost. Set the DODO_* keys.",
    );

  const checkouts = new Map<string, CheckoutInput>();
  const refunds = new Map<
    string,
    { paymentId: string; amountCents: number; currency: string; partial: boolean }
  >();

  return {
    name: "fake",

    async createCheckout(input) {
      checkCheckoutInput(input);
      const checkoutId = fakeId("cks", input.userId, input.productKey, now());
      checkouts.set(checkoutId, input);
      return {
        checkoutId,
        clientConfig: {
          provider: "fake",
          transactionId: checkoutId,
          productKey: input.productKey,
          amountCents: input.priceCents,
          currency: input.currency,
          customerEmail: input.customerEmail,
          successUrl: input.successUrl,
          ...(input.discountCode ? { discountCode: input.discountCode } : {}),
        },
      };
    },

    verifyWebhook: (rawBody, headers) => verifySignedWebhook(rawBody, headers, { secret, now }),

    parseEvent: mapDodoEvent,

    async refund(input): Promise<RefundResult> {
      // A purchase from an earlier dev-server process isn't in memory; refund it as USD.
      const checkout = [...checkouts].find(
        ([id]) => fakePaymentId(id) === input.providerTxnId,
      )?.[1];
      // Same validation and body as Dodo, so a bad partial amount fails here too.
      await refundBody(input, async () => fakeId("pdt", input.providerTxnId));
      const refundId = fakeId("ref", input.providerTxnId, input.amountCents ?? "full", now());
      refunds.set(refundId, {
        paymentId: input.providerTxnId,
        amountCents: input.amountCents ?? checkout?.priceCents ?? 0,
        currency: checkout?.currency ?? "USD",
        partial: input.amountCents !== undefined,
      });
      return { adjustmentId: refundId, status: "approved" };
    },

    completeCheckout(checkoutId, outcome = "paid") {
      const checkout = checkouts.get(checkoutId);
      if (!checkout) throw new PaymentsConfigError(`No fake checkout ${checkoutId}.`);
      const base = {
        checkoutId,
        userId: checkout.userId,
        productKey: checkout.productKey,
        currency: checkout.currency,
      };
      return buildSignedFakeWebhook(
        outcome === "paid"
          ? { type: "purchase_completed", ...base, amountCents: checkout.priceCents }
          : { type: "payment_failed", ...base },
        { secret, now },
      );
    },

    refundWebhook(refundId) {
      const refund = refunds.get(refundId);
      if (!refund) throw new PaymentsConfigError(`No fake refund ${refundId}.`);
      return buildSignedFakeWebhook(
        { type: "refund_completed", refundId, ...refund },
        { secret, now },
      );
    },
  };
}
