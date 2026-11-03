import type { z } from "zod";
import {
  parseProductKey,
  WebhookPayloadError,
  type PaymentEvent,
  type ProductKey,
  type VerifiedWebhook,
} from "./provider";
import { AdjustmentData, OurCustomData, TransactionData } from "./schemas";

// Paddle webhook → normalized PaymentEvent. Shared by the Paddle adapter and the fake (which sends
// Paddle-shaped payloads), so the mapping the app relies on is the one tested against the fixtures.
//
// Events we act on (§13):
//  - transaction.completed: purchase + entitlement + kit/generate
//  - adjustment.created / adjustment.updated with status "approved" and action "refund" or
//    "chargeback": revoke the entitlement. Live refunds usually arrive as pending_approval first,
//    then updated; chargebacks arrive approved.
//  - transaction.payment_failed: logged, shown to the buyer by the overlay itself
// Everything else is verified and acknowledged as "ignored". Data we can't attribute to a user and
// school is "ignored" with alertAdmin rather than thrown: throwing makes the route fail, Paddle
// retries for days, and the money still sits there with nobody told.

function parse<T extends z.ZodType>(schema: T, data: unknown, eventType: string): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new WebhookPayloadError(`Invalid ${eventType} payload: ${result.error.message}`);
  return result.data;
}

type Owner = { userId: string; schoolCycleId: string; productKey: ProductKey };

/** Our custom data, or why the transaction can't be attributed to a user and school. */
function ours(transaction: TransactionData): Owner | { problem: string } {
  const custom = OurCustomData.safeParse(transaction.custom_data ?? {});
  if (!custom.success) return { problem: "has no AdmitStory custom data" };
  const product = parseProductKey(custom.data.product_key);
  // A product key that disagrees with its own school cycle means the data was edited after we
  // created the transaction; refuse it rather than grant the wrong school.
  if (!product || product.schoolCycleId !== custom.data.school_cycle_id)
    return {
      problem: `carries inconsistent custom data (product_key ${custom.data.product_key}, school_cycle_id ${custom.data.school_cycle_id})`,
    };
  return {
    userId: custom.data.user_id,
    schoolCycleId: product.schoolCycleId,
    productKey: custom.data.product_key as ProductKey,
  };
}

export function mapPaddleEvent(webhook: VerifiedWebhook): PaymentEvent {
  const { eventId, eventType, occurredAt, payload } = webhook;
  const data = (payload as { data?: unknown }).data;
  const ignored = (reason: string, alertAdmin = false): PaymentEvent => ({
    type: "ignored",
    eventId,
    eventType,
    reason,
    alertAdmin,
    raw: payload,
  });

  switch (eventType) {
    case "transaction.completed": {
      const transaction = parse(TransactionData, data, eventType);
      const owner = ours(transaction);
      if ("problem" in owner)
        return ignored(`Completed transaction ${transaction.id} ${owner.problem}.`, true);
      if (!transaction.details)
        throw new WebhookPayloadError(`Completed transaction ${transaction.id} has no totals.`);
      const { totals } = transaction.details;
      return {
        type: "purchase_completed",
        eventId,
        occurredAt,
        providerTxnId: transaction.id,
        ...owner,
        amountCents: totals.grand_total ?? totals.total,
        currency: totals.currency_code,
        discountId: transaction.discount_id ?? null,
        raw: payload,
      };
    }
    case "transaction.payment_failed": {
      const transaction = parse(TransactionData, data, eventType);
      const found = ours(transaction);
      const owner = "problem" in found ? null : found;
      const failed = transaction.payments?.filter((payment) => payment.status === "error").at(-1);
      return {
        type: "payment_failed",
        eventId,
        occurredAt,
        providerTxnId: transaction.id,
        userId: owner?.userId ?? null,
        productKey: owner?.productKey ?? null,
        errorCode: failed?.error_code ?? null,
        raw: payload,
      };
    }
    case "adjustment.created":
    case "adjustment.updated": {
      const adjustment = parse(AdjustmentData, data, eventType);
      // Actions that take the buyer's money back; credits and warnings don't.
      const kind =
        adjustment.action === "refund" || adjustment.action === "chargeback"
          ? adjustment.action
          : null;
      if (!kind)
        return ignored(
          `Adjustment ${adjustment.id} is a ${adjustment.action}, not a refund.`,
          // A reversed chargeback returns money we already revoked for: a person decides.
          adjustment.action === "chargeback_reverse",
        );
      if (adjustment.status !== "approved")
        return ignored(
          `${kind === "refund" ? "Refund" : "Chargeback"} ${adjustment.id} is ${adjustment.status}.`,
        );
      return {
        type: "refund_completed",
        eventId,
        occurredAt,
        providerTxnId: adjustment.transaction_id,
        adjustmentId: adjustment.id,
        kind,
        partial: adjustment.type === "partial",
        amountCents: adjustment.totals.total,
        currency: adjustment.currency_code,
        raw: payload,
      };
    }
    default:
      return ignored(`${eventType} is not handled.`);
  }
}
