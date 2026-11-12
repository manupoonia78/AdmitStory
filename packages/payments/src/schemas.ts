import { z } from "zod";

// Zod validators for Dodo Payments webhook payloads and API responses. Server-only: the browser
// entry (client.ts) must never import this module (a top-level Zod schema can't be tree-shaken).
//
// Field names follow Dodo's API reference and the `dodopayments` SDK types (v2.61, checked
// 6 November 2026). Objects are loose: Dodo adds fields without a version bump, and we validate
// only what we read. Money is an integer in the currency's smallest unit, except a dispute's
// `amount`, which is a string.

const Currency = z.string().regex(/^[A-Z]{3}$/, "expected an ISO 4217 currency code");
const Cents = z.number().int();

/** The JSON body Dodo posts; the event id travels in the `webhook-id` header. */
export const WebhookEnvelope = z.looseObject({
  business_id: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.string().min(1),
  data: z.unknown(),
});

/** Our metadata on the checkout session, copied onto its payment (§13: user and school cycle). */
export const OurMetadata = z.looseObject({
  user_id: z.string().min(1),
  school_cycle_id: z.string().min(1),
  product_key: z.string().min(1),
});

export const PaymentData = z.looseObject({
  payment_id: z.string().min(1),
  checkout_session_id: z.string().nullish(),
  status: z.string().nullish(),
  total_amount: Cents,
  currency: Currency,
  metadata: z.record(z.string(), z.unknown()).nullish(),
  discount_id: z.string().nullish(),
  discounts: z.array(z.looseObject({ discount_id: z.string() })).nullish(),
  error_code: z.string().nullish(),
});
export type PaymentData = z.output<typeof PaymentData>;

export const RefundData = z.looseObject({
  refund_id: z.string().min(1),
  payment_id: z.string().min(1),
  status: z.string(),
  is_partial: z.boolean(),
  amount: Cents.nullish(),
  currency: Currency.nullish(),
});
export type RefundData = z.output<typeof RefundData>;

export const DisputeData = z.looseObject({
  dispute_id: z.string().min(1),
  payment_id: z.string().min(1),
  dispute_status: z.string(),
  amount: z.string(),
  currency: z.string(),
});
export type DisputeData = z.output<typeof DisputeData>;

export const CheckoutSessionResponse = z.looseObject({
  session_id: z.string().min(1),
  checkout_url: z.url(),
});

export const PaymentProductsResponse = z.looseObject({
  payment_id: z.string(),
  product_cart: z.array(z.looseObject({ product_id: z.string() })).nullish(),
});

export const RefundResponse = z.looseObject({
  refund_id: z.string().min(1),
  status: z.enum(["succeeded", "failed", "pending", "review"]),
});

export const ApiErrorBody = z.looseObject({
  code: z.string().nullish(),
  message: z.string().nullish(),
});
