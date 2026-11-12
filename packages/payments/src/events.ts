import type { z } from "zod";
import {
  parseProductKey,
  WebhookPayloadError,
  type PaymentEvent,
  type ProductKey,
  type VerifiedWebhook,
} from "./provider";
import { DisputeData, OurMetadata, PaymentData, RefundData } from "./schemas";

// Dodo webhook → normalized PaymentEvent. Shared by the Dodo adapter and the fake (which sends
// Dodo-shaped payloads), so the mapping the app relies on is the one the fake exercises locally.
//
// Events we act on (§13):
//  - payment.succeeded: purchase + entitlement + kit/generate
//  - refund.succeeded: revoke the entitlement (a partial refund is recorded; admin decides)
//  - dispute.lost / dispute.accepted: the buyer's bank took the money back; revoke
//  - dispute.opened: nothing changes yet, but an admin should answer it, so alert
//  - payment.failed: logged, shown to the buyer by the overlay itself
// Everything else is verified and acknowledged as "ignored". Data we can't attribute to a user and
// school is "ignored" with alertAdmin rather than thrown: throwing makes the route fail, Dodo
// retries for a day, and the money still sits there with nobody told.

function parse<T extends z.ZodType>(schema: T, data: unknown, eventType: string): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new WebhookPayloadError(`Invalid ${eventType} payload: ${result.error.message}`);
  return result.data;
}

type Owner = {
  userId: string;
  schoolCycleId: string;
  productKey: ProductKey;
  providerCheckoutId: string;
};

/** Our metadata and checkout, or why the payment can't be attributed to a user and school. */
function ours(payment: PaymentData): Owner | { problem: string } {
  const meta = OurMetadata.safeParse(payment.metadata ?? {});
  if (!meta.success) return { problem: "has no AdmitStories metadata" };
  if (!payment.checkout_session_id) return { problem: "did not come from a checkout session" };
  const product = parseProductKey(meta.data.product_key);
  // A product key that disagrees with its own school cycle means the data was edited after we
  // created the session; refuse it rather than grant the wrong school.
  if (!product || product.schoolCycleId !== meta.data.school_cycle_id)
    return {
      problem: `carries inconsistent metadata (product_key ${meta.data.product_key}, school_cycle_id ${meta.data.school_cycle_id})`,
    };
  return {
    userId: meta.data.user_id,
    schoolCycleId: product.schoolCycleId,
    productKey: meta.data.product_key as ProductKey,
    providerCheckoutId: payment.checkout_session_id,
  };
}

/** A dispute's amount arrives as a string; whole numbers are already in the smallest unit. */
function disputeCents(amount: string): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return 0;
  return /^\d+$/.test(amount.trim()) ? parsed : Math.round(parsed * 100);
}

export function mapDodoEvent(webhook: VerifiedWebhook): PaymentEvent {
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
    case "payment.succeeded": {
      const payment = parse(PaymentData, data, eventType);
      const owner = ours(payment);
      if ("problem" in owner)
        return ignored(`Succeeded payment ${payment.payment_id} ${owner.problem}.`, true);
      return {
        type: "purchase_completed",
        eventId,
        occurredAt,
        providerTxnId: payment.payment_id,
        ...owner,
        amountCents: payment.total_amount,
        currency: payment.currency,
        discountId: payment.discounts?.[0]?.discount_id ?? payment.discount_id ?? null,
        raw: payload,
      };
    }
    case "payment.failed": {
      const payment = parse(PaymentData, data, eventType);
      const found = ours(payment);
      const owner = "problem" in found ? null : found;
      return {
        type: "payment_failed",
        eventId,
        occurredAt,
        providerCheckoutId: owner?.providerCheckoutId ?? null,
        providerTxnId: payment.payment_id,
        userId: owner?.userId ?? null,
        productKey: owner?.productKey ?? null,
        errorCode: payment.error_code ?? null,
        raw: payload,
      };
    }
    case "refund.succeeded": {
      const refund = parse(RefundData, data, eventType);
      return {
        type: "refund_completed",
        eventId,
        occurredAt,
        providerTxnId: refund.payment_id,
        adjustmentId: refund.refund_id,
        kind: "refund",
        partial: refund.is_partial,
        amountCents: refund.amount ?? 0,
        currency: refund.currency ?? null,
        raw: payload,
      };
    }
    case "dispute.lost":
    case "dispute.accepted": {
      const dispute = parse(DisputeData, data, eventType);
      return {
        type: "refund_completed",
        eventId,
        occurredAt,
        providerTxnId: dispute.payment_id,
        adjustmentId: dispute.dispute_id,
        kind: "chargeback",
        partial: false,
        amountCents: disputeCents(dispute.amount),
        currency: dispute.currency.toUpperCase(),
        raw: payload,
      };
    }
    case "dispute.opened": {
      const dispute = parse(DisputeData, data, eventType);
      // The kit stays until the dispute is lost; someone should send Dodo evidence meanwhile.
      return ignored(
        `Dispute ${dispute.dispute_id} opened on payment ${dispute.payment_id}.`,
        true,
      );
    }
    default:
      return ignored(`${eventType} is not handled.`);
  }
}
