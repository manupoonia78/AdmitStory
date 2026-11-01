import { z } from "zod";

// Zod validators for Paddle webhook payloads and API responses. Server-only: the browser entry
// (client.ts) must never import this module (a top-level Zod schema can't be tree-shaken).
//
// Field names follow Paddle Billing's docs (developer.paddle.com, checked 31 October 2026). Objects
// are loose: Paddle adds fields without a version bump, and we validate only what we read. Money
// arrives as a string of an integer in the currency's smallest unit.

const paddleId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-z0-9]+$`), `expected a ${prefix}_… id`);

/** "1000" → 1000. Rejects decimals, so a fractional amount never reaches a purchase row. */
export const AmountString = z
  .string()
  .regex(/^-?\d+$/, "expected an integer amount in the smallest currency unit")
  .transform(Number);

const Currency = z.string().regex(/^[A-Z]{3}$/, "expected an ISO 4217 currency code");

export const WebhookEnvelope = z.looseObject({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  occurred_at: z.string().min(1),
  notification_id: z.string().optional(),
  data: z.unknown(),
});

/** Our metadata on the transaction (§13: checkout metadata carries user_id and school_cycle_id). */
export const OurCustomData = z.looseObject({
  user_id: z.string().min(1),
  school_cycle_id: z.string().min(1),
  product_key: z.string().min(1),
});

export const TransactionData = z.looseObject({
  id: paddleId("txn"),
  status: z.string(),
  currency_code: Currency,
  customer_id: z.string().nullish(),
  discount_id: z.string().nullish(),
  custom_data: z.record(z.string(), z.unknown()).nullish(),
  details: z
    .looseObject({
      totals: z.looseObject({
        total: AmountString,
        grand_total: AmountString.optional(),
        currency_code: Currency,
      }),
      line_items: z.array(z.looseObject({ id: z.string() })).optional(),
    })
    .nullish(),
  payments: z
    .array(
      z.looseObject({
        status: z.string(),
        error_code: z.string().nullish(),
        created_at: z.string().optional(),
      }),
    )
    .optional(),
});
export type TransactionData = z.output<typeof TransactionData>;

export const AdjustmentData = z.looseObject({
  id: paddleId("adj"),
  action: z.string(),
  type: z.string().optional(),
  transaction_id: paddleId("txn"),
  status: z.string(),
  currency_code: Currency,
  totals: z.looseObject({ total: AmountString }),
});
export type AdjustmentData = z.output<typeof AdjustmentData>;

export const CreatedTransactionResponse = z.looseObject({
  data: z.looseObject({ id: paddleId("txn"), status: z.string() }),
});

export const TransactionLineItemsResponse = z.looseObject({
  data: z.looseObject({
    id: paddleId("txn"),
    details: z.looseObject({ line_items: z.array(z.looseObject({ id: z.string() })).min(1) }),
  }),
});

export const AdjustmentResponse = z.looseObject({
  data: z.looseObject({
    id: paddleId("adj"),
    status: z.enum(["pending_approval", "approved", "rejected", "reversed"]),
  }),
});

export const ApiErrorBody = z.looseObject({
  error: z.looseObject({
    type: z.string().optional(),
    code: z.string().optional(),
    detail: z.string().optional(),
  }),
});
