import { createHash } from "node:crypto";
import { isLocalUrl } from "./env";
import { mapPaddleEvent } from "./events";
import { checkCheckoutInput, refundBody } from "./paddle";
import {
  parseProductKey,
  PaymentsConfigError,
  type CheckoutInput,
  type PaymentsProvider,
  type ProductKey,
  type RefundResult,
} from "./provider";
import { signatureHeader, verifySignedWebhook } from "./signature";

// The development payments provider, chosen when Paddle isn't configured and APP_URL is localhost.
// The app renders its own local overlay for a "fake" checkout; when the buyer confirms, it asks
// this provider for a Paddle-shaped webhook signed with the same scheme Paddle uses and posts it
// to its own /api/webhooks/paddle route. So the signature check, payload validation, event
// mapping and purchase idempotency all run exactly as they will in production. Ids are derived
// from their inputs and the clock (deterministic under a fixed `now`).

/** Not a secret: it only ever verifies webhooks the fake itself signed, on localhost. */
export const FAKE_WEBHOOK_SECRET = "fake_paddle_webhook_secret_localhost_only";

export const fakeId = (prefix: string, ...parts: (string | number)[]): string =>
  `${prefix}_${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 26)}`;

export type FakeWebhookEvent =
  | {
      type: "purchase_completed";
      transactionId: string;
      userId: string;
      productKey: ProductKey;
      amountCents: number;
      currency: string;
      discountId?: string | null;
    }
  | {
      type: "refund_completed";
      transactionId: string;
      adjustmentId: string;
      amountCents: number;
      currency: string;
      partial?: boolean;
    }
  | {
      type: "payment_failed";
      transactionId: string;
      userId: string;
      productKey: ProductKey;
      currency: string;
      errorCode?: string;
    };

export interface SignedWebhook {
  body: string;
  headers: Record<string, string>;
}

/** A Paddle-shaped webhook for `event`, signed as Paddle signs (ts=…;h1=…). */
export function buildSignedFakeWebhook(
  event: FakeWebhookEvent,
  { secret = FAKE_WEBHOOK_SECRET, now = Date.now }: { secret?: string; now?: () => number } = {},
): SignedWebhook {
  const at = now();
  const occurredAt = new Date(at).toISOString();
  const timestamp = Math.floor(at / 1000);
  let payload: Record<string, unknown>;

  if (event.type === "refund_completed") {
    payload = {
      event_id: fakeId("evt", event.type, event.adjustmentId),
      event_type: "adjustment.updated",
      occurred_at: occurredAt,
      notification_id: fakeId("ntf", event.type, event.adjustmentId, at),
      data: {
        id: event.adjustmentId,
        action: "refund",
        type: event.partial ? "partial" : "full",
        reason: "requested_by_customer",
        status: "approved",
        transaction_id: event.transactionId,
        currency_code: event.currency,
        totals: { total: String(event.amountCents), currency_code: event.currency },
        created_at: occurredAt,
        updated_at: occurredAt,
      },
    };
  } else {
    const product = parseProductKey(event.productKey);
    if (!product) throw new PaymentsConfigError(`Unknown product key "${event.productKey}".`);
    const completed = event.type === "purchase_completed";
    const amount = String(completed ? event.amountCents : 0);
    payload = {
      event_id: fakeId("evt", event.type, event.transactionId),
      event_type: completed ? "transaction.completed" : "transaction.payment_failed",
      occurred_at: occurredAt,
      notification_id: fakeId("ntf", event.type, event.transactionId, at),
      data: {
        id: event.transactionId,
        status: completed ? "completed" : "ready",
        customer_id: fakeId("ctm", event.userId),
        currency_code: event.currency,
        discount_id: completed ? (event.discountId ?? null) : null,
        custom_data: {
          user_id: event.userId,
          school_cycle_id: product.schoolCycleId,
          product_key: event.productKey,
        },
        details: {
          totals: { total: amount, grand_total: amount, currency_code: event.currency },
          line_items: [{ id: fakeId("txnitm", event.transactionId) }],
        },
        payments: [
          completed
            ? { status: "captured", error_code: null, created_at: occurredAt }
            : {
                status: "error",
                error_code: event.errorCode ?? "declined",
                created_at: occurredAt,
              },
        ],
      },
    };
  }

  const body = JSON.stringify(payload);
  return {
    body,
    headers: {
      "content-type": "application/json",
      "paddle-signature": signatureHeader(secret, body, timestamp),
    },
  };
}

export interface FakePaymentsProvider extends PaymentsProvider {
  name: "fake";
  /** The signed webhook for a checkout this provider created: what Paddle sends after payment. */
  completeCheckout(transactionId: string, outcome?: "paid" | "declined"): SignedWebhook;
  /** The signed webhook that approves a refund this provider created. */
  refundWebhook(adjustmentId: string): SignedWebhook;
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
  // A deployed app without Paddle keys must say checkout is unavailable, not grant kits for free.
  if (!isLocalUrl(appUrl))
    throw new PaymentsConfigError(
      "The fake payments provider runs only when APP_URL is localhost. Set the PADDLE_* keys.",
    );

  const checkouts = new Map<string, CheckoutInput>();
  const refunds = new Map<
    string,
    { transactionId: string; amountCents: number; currency: string; partial: boolean }
  >();

  return {
    name: "fake",

    async createCheckout(input) {
      checkCheckoutInput(input);
      const transactionId = fakeId("txn", input.userId, input.productKey, now());
      checkouts.set(transactionId, input);
      return {
        checkoutId: transactionId,
        clientConfig: {
          provider: "fake",
          transactionId,
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

    parseEvent: mapPaddleEvent,

    async refund(input): Promise<RefundResult> {
      // A purchase from an earlier dev-server process isn't in memory; refund it as USD.
      const checkout = checkouts.get(input.providerTxnId);
      // Same validation and body as Paddle, so a bad partial amount fails here too.
      await refundBody(input, async () => fakeId("txnitm", input.providerTxnId));
      const adjustmentId = fakeId("adj", input.providerTxnId, input.amountCents ?? "full", now());
      refunds.set(adjustmentId, {
        transactionId: input.providerTxnId,
        amountCents: input.amountCents ?? checkout?.priceCents ?? 0,
        currency: checkout?.currency ?? "USD",
        partial: input.amountCents !== undefined,
      });
      return { adjustmentId, status: "approved" };
    },

    completeCheckout(transactionId, outcome = "paid") {
      const checkout = checkouts.get(transactionId);
      if (!checkout) throw new PaymentsConfigError(`No fake checkout ${transactionId}.`);
      const base = {
        transactionId,
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

    refundWebhook(adjustmentId) {
      const refund = refunds.get(adjustmentId);
      if (!refund) throw new PaymentsConfigError(`No fake refund ${adjustmentId}.`);
      return buildSignedFakeWebhook(
        { type: "refund_completed", adjustmentId, ...refund },
        {
          secret,
          now,
        },
      );
    },
  };
}
