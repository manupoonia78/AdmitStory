// The payments contract (spec §5.6, §13). Plain types and small pure helpers only: the browser
// imports these through `@admitstory/payments/client`, so nothing here may pull in Zod, node:crypto
// or a secret. Providers (Paddle, the local fake) live behind this interface so Lemon Squeezy,
// Stripe or Razorpay can be added later without touching the app.

export type PaymentsProviderName = "paddle" | "fake";
export type PaddleEnvironment = "sandbox" | "live";

/** One-time product per school per cycle (§5.6). Expert sessions arrive in Phase 8. */
export type ProductKey = `school_kit:${string}`;

export const schoolKitProductKey = (schoolCycleId: string): ProductKey =>
  `school_kit:${schoolCycleId}`;

/** The school cycle a product key names, or null when it is not a school kit key. */
export function parseProductKey(key: string): { kind: "school_kit"; schoolCycleId: string } | null {
  const match = /^school_kit:([A-Za-z0-9_-]{1,64})$/.exec(key);
  return match?.[1] ? { kind: "school_kit", schoolCycleId: match[1] } : null;
}

export interface CheckoutInput {
  userId: string;
  productKey: ProductKey;
  /** Smallest currency unit. Ignored by Paddle when PADDLE_PRICE_SCHOOL_KIT names a catalog price. */
  priceCents: number;
  /** ISO 4217, upper case. */
  currency: string;
  customerEmail: string;
  /** Where the overlay sends the buyer after paying (the Kit view). */
  successUrl: string;
  /** A launch or referral code the buyer typed; the provider's checkout applies and checks it. */
  discountCode?: string;
  /** What the buyer's receipt calls the item, e.g. "Fictional School School Kit, 2026–27". */
  label?: string;
}

/** What the browser needs to open the checkout. Never contains a secret. */
export type CheckoutClientConfig =
  | {
      provider: "paddle";
      environment: PaddleEnvironment;
      /** Paddle client-side token (`test_…` or `live_…`), safe to expose. */
      clientToken: string;
      transactionId: string;
      customerEmail: string;
      successUrl: string;
      discountCode?: string;
    }
  | {
      provider: "fake";
      transactionId: string;
      productKey: ProductKey;
      amountCents: number;
      currency: string;
      customerEmail: string;
      successUrl: string;
      discountCode?: string;
    };

export interface CheckoutSession {
  /** The provider's transaction id (`txn_…`); purchases are idempotent on it. */
  checkoutId: string;
  clientConfig: CheckoutClientConfig;
}

/** Normalized webhook events. `raw` is the verified provider payload, kept for the purchase row. */
export type PaymentEvent =
  | {
      type: "purchase_completed";
      eventId: string;
      occurredAt: string;
      providerTxnId: string;
      productKey: ProductKey;
      userId: string;
      schoolCycleId: string;
      /** What the buyer paid, tax included, in `currency`'s smallest unit. */
      amountCents: number;
      currency: string;
      discountId: string | null;
      raw: unknown;
    }
  | {
      type: "refund_completed";
      eventId: string;
      occurredAt: string;
      providerTxnId: string;
      adjustmentId: string;
      /** A refund we or Paddle approved, or a chargeback the buyer's bank forced. Both revoke. */
      kind: "refund" | "chargeback";
      /** True when only part of the price came back; the app decides whether that revokes. */
      partial: boolean;
      amountCents: number;
      currency: string;
      raw: unknown;
    }
  | {
      type: "payment_failed";
      eventId: string;
      occurredAt: string;
      providerTxnId: string;
      userId: string | null;
      productKey: ProductKey | null;
      errorCode: string | null;
      raw: unknown;
    }
  | {
      /**
       * Verified but not ours to act on: another event type, a refund still awaiting approval, or a
       * completed transaction without usable custom data. `reason` says which. When `alertAdmin`
       * is true, money moved without a matching entitlement change: acknowledge the webhook (so
       * Paddle stops retrying) and alert admin.
       */
      type: "ignored";
      eventId: string;
      eventType: string;
      reason: string;
      alertAdmin: boolean;
      raw: unknown;
    };

/** A webhook whose signature and envelope have been checked. */
export interface VerifiedWebhook {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: unknown;
}

/** Admin refund reason codes (§13; the policy itself is open in §18). */
export const REFUND_REASONS = [
  "requested_by_customer",
  "duplicate",
  "pipeline_failed",
  "fraud",
  "goodwill",
  "other",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export interface RefundInput {
  providerTxnId: string;
  reason: RefundReason;
  /** Omit for a full refund. */
  amountCents?: number;
  /** Free-text note for the provider's records; never shown to the buyer. */
  note?: string;
}

export interface RefundResult {
  adjustmentId: string;
  /** Live Paddle refunds usually wait for Paddle's review; the entitlement is revoked on approval. */
  status: "pending_approval" | "approved" | "rejected" | "reversed";
}

export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

export interface PaymentsProvider {
  name: PaymentsProviderName;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** Checks the signature over the exact raw body; throws WebhookVerificationError otherwise. */
  verifyWebhook(rawBody: string, headers: WebhookHeaders): VerifiedWebhook;
  /** Validates the payload and maps it to a normalized event; throws WebhookPayloadError. */
  parseEvent(webhook: VerifiedWebhook): PaymentEvent;
  refund(input: RefundInput): Promise<RefundResult>;
}

export class WebhookVerificationError extends Error {
  override name = "WebhookVerificationError";
  constructor(
    message: string,
    readonly code:
      "missing_signature" | "malformed_signature" | "stale" | "mismatch" | "malformed_body",
  ) {
    super(message);
  }
}

export class WebhookPayloadError extends Error {
  override name = "WebhookPayloadError";
}

export class PaymentsConfigError extends Error {
  override name = "PaymentsConfigError";
}

export class PaymentsApiError extends Error {
  override name = "PaymentsApiError";
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
  }
}
