import "server-only";

import {
  applyPurchaseCompleted,
  applyRefund,
  getCycleWithSchool,
  getDb,
  getUserSchool,
  recordAudit,
  recordCheckout,
  recordWebhookEvent,
  setCheckoutStatus,
  systemContext,
} from "@admitstory/db";
import {
  PaymentsConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
  schoolKitProductKey,
  selectPaymentsProvider,
  type CheckoutClientConfig,
  type PaymentEvent,
  type PaymentsProvider,
  type WebhookHeaders,
} from "@admitstory/payments";
import { kitGenerate } from "@/inngest/events";
import { ApiError } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { latestPack } from "@/lib/strategy/server";
import { dispatch } from "@/lib/strategy/dispatch";
import { runKitGeneration } from "@/lib/kit/run";

// Checkout and the payments webhook (spec §5.6, §13). The webhook, never the browser, grants a kit:
// it is verified over the raw body, applied once per provider event and transaction, checked
// against the checkout row this server wrote, and only then sends kit/generate.

/** A flat $100 per school kit (§18 default, Manu 2026-10-31). */
export const SCHOOL_KIT_PRICE_CENTS = 10_000;
export const SCHOOL_KIT_CURRENCY = "USD";

let override: PaymentsProvider | null = null;
let cached: PaymentsProvider | null = null;

/** The configured provider: Paddle with keys, the fake on localhost without them. */
export function payments(): PaymentsProvider {
  if (override) return override;
  cached ??= selectPaymentsProvider();
  return cached;
}

/** For tests. */
export function setPaymentsProvider(provider: PaymentsProvider | null): void {
  override = provider;
  cached = null;
}

export interface OpenedCheckout {
  checkoutId: string;
  clientConfig: CheckoutClientConfig;
}

/**
 * Opens a checkout for one school on the caller's list. Refuses a school that isn't theirs (404),
 * one without a published pack (409, "Pack coming soon" is never purchasable) and one already
 * unlocked (409).
 */
export async function openSchoolCheckout(
  user: { id: string; email: string },
  userSchoolId: string,
  options: { discountCode?: string } = {},
): Promise<OpenedCheckout> {
  const db = getDb();
  const row = await getUserSchool(db, user.id, userSchoolId);
  if (!row) throw new ApiError(404, "That school could not be found.");
  const [published, cycle] = await Promise.all([
    latestPack(db, row.schoolCycleId),
    getCycleWithSchool(db, row.schoolCycleId),
  ]);
  const name = cycle?.school.shortName ?? cycle?.school.name ?? "This school";
  if (!published) throw new ApiError(409, `${name}'s pack is coming soon. It can't be bought yet.`);
  if (row.status !== "considering" && row.status !== "preview")
    throw new ApiError(409, `You've already unlocked ${name}.`);

  const productKey = schoolKitProductKey(row.schoolCycleId);
  let provider: PaymentsProvider;
  try {
    provider = payments();
  } catch (error) {
    // A deployed app without payment keys says so; it never grants kits for free (§13).
    if (error instanceof PaymentsConfigError)
      throw new ApiError(503, "Checkout isn't available right now. Try again later.");
    throw error;
  }
  const session = await provider.createCheckout({
    userId: user.id,
    productKey,
    priceCents: SCHOOL_KIT_PRICE_CENTS,
    currency: SCHOOL_KIT_CURRENCY,
    customerEmail: user.email,
    successUrl: `${serverEnv().APP_URL}/schools/${userSchoolId}/unlock?paid=1`,
    label: `${name} School Kit, ${cycle?.cycle ?? ""}`.trim(),
    ...(options.discountCode ? { discountCode: options.discountCode } : {}),
  });
  const recorded = await recordCheckout(db, user.id, {
    provider: provider.name,
    providerCheckoutId: session.checkoutId,
    userSchoolId,
    amountCents: SCHOOL_KIT_PRICE_CENTS,
    currency: SCHOOL_KIT_CURRENCY,
  });
  if (!recorded) throw new ApiError(404, "That school could not be found.");
  return session;
}

export type WebhookResult = { status: number; body: Record<string, unknown> };

async function alertAdmin(reason: string, meta: Record<string, unknown>): Promise<void> {
  // Admin alerts are audit rows an admin reviews in the Orders console (§13).
  console.warn("[payments] admin alert:", reason);
  await recordAudit(systemContext(getDb(), "payments.webhook"), {
    action: "webhook_events.alert",
    targetType: "webhook_event",
    targetId: typeof meta.eventId === "string" ? meta.eventId : null,
    reason,
    meta,
  });
}

/**
 * Handles one webhook delivery end to end. 401 when the signature fails, 400 for a payload that
 * will never parse, 200 once the event is applied or recognised as a replay, and a thrown error
 * (500) for anything else so the provider retries.
 */
export async function processWebhook(
  rawBody: string,
  headers: WebhookHeaders,
): Promise<WebhookResult> {
  const provider = payments();
  let event: PaymentEvent;
  try {
    event = provider.parseEvent(provider.verifyWebhook(rawBody, headers));
  } catch (error) {
    if (error instanceof WebhookVerificationError)
      return { status: 401, body: { error: "Signature check failed." } };
    if (error instanceof WebhookPayloadError)
      return { status: 400, body: { error: "Payload not recognised." } };
    throw error;
  }
  const db = getDb();
  const base = { provider: provider.name, eventId: event.eventId };

  switch (event.type) {
    case "purchase_completed": {
      const outcome = await applyPurchaseCompleted(db, {
        ...base,
        type: event.type,
        providerTxnId: event.providerTxnId,
        productKey: event.productKey,
        userId: event.userId,
        schoolCycleId: event.schoolCycleId,
        amountCents: event.amountCents,
        currency: event.currency,
        discountId: event.discountId,
        raw: event.raw,
      });
      if (outcome.outcome === "mismatch") {
        await setCheckoutStatus(db, event.providerTxnId, "mismatch");
        await alertAdmin(`purchase did not match its checkout: ${outcome.reason}`, {
          eventId: event.eventId,
          providerTxnId: event.providerTxnId,
        });
        return { status: 200, body: { outcome: "mismatch" } };
      }
      if (outcome.outcome === "applied") {
        await setCheckoutStatus(db, event.providerTxnId, "completed");
        if (outcome.alreadyEntitled)
          await alertAdmin("second purchase for a school the buyer already owns; refund it", {
            eventId: event.eventId,
            providerTxnId: event.providerTxnId,
          });
        const { kitId, userId } = outcome;
        await dispatch(kitGenerate.create({ kitId, userId }), () =>
          runKitGeneration({ kitId, userId }),
        );
      }
      return { status: 200, body: { outcome: outcome.outcome } };
    }
    case "refund_completed": {
      const outcome = await applyRefund(db, {
        ...base,
        type: event.type,
        providerTxnId: event.providerTxnId,
        adjustmentId: event.adjustmentId,
        kind: event.kind,
        partial: event.partial,
        amountCents: event.amountCents,
      });
      if (outcome.outcome === "unknown_purchase")
        await alertAdmin("refund for a purchase we have no record of", {
          eventId: event.eventId,
          providerTxnId: event.providerTxnId,
        });
      return { status: 200, body: { outcome: outcome.outcome } };
    }
    case "payment_failed": {
      await setCheckoutStatus(db, event.providerTxnId, "failed");
      await recordWebhookEvent(db, { ...base, type: event.type, outcome: "applied" });
      return { status: 200, body: { outcome: "failed" } };
    }
    case "ignored": {
      const fresh = await recordWebhookEvent(db, {
        ...base,
        type: event.eventType,
        outcome: "ignored",
        detail: event.reason,
      });
      if (fresh && event.alertAdmin)
        await alertAdmin(`money moved without an entitlement change: ${event.reason}`, {
          eventId: event.eventId,
        });
      return { status: 200, body: { outcome: "ignored" } };
    }
  }
}
