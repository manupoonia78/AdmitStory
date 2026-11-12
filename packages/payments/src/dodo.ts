import type { z } from "zod";
import { mapDodoEvent } from "./events";
import {
  parseProductKey,
  PaymentsApiError,
  PaymentsConfigError,
  type CheckoutInput,
  type DodoEnvironment,
  type PaymentsProvider,
  type ProductKind,
  type RefundInput,
  type RefundResult,
} from "./provider";
import {
  ApiErrorBody,
  CheckoutSessionResponse,
  PaymentProductsResponse,
  RefundResponse,
} from "./schemas";
import { verifySignedWebhook } from "./signature";

// Dodo Payments adapter (spec §13), plain fetch, no SDK. Dodo is the merchant of record: it sells
// the kit, adds tax where it applies and issues the receipt. Checked against docs.dodopayments.com
// and the `dodopayments` SDK types on 6 November 2026:
//  - base URLs: https://test.dodopayments.com and https://live.dodopayments.com;
//    `Authorization: Bearer <api key>`.
//  - POST /checkouts {product_cart: [{product_id, quantity}], customer: {email}, return_url,
//    metadata, discount_codes} → {session_id, checkout_url}. The browser opens the overlay on that
//    URL, so the metadata is set by our server and can't be chosen by the buyer. The metadata is
//    copied onto the payment, and the payment carries `checkout_session_id`.
//  - Each product kind is a one-time product in Dodo's catalog (DODO_PRODUCT_*), priced there;
//    `pnpm --filter @admitstory/web payments:products` creates them from SCHOOL_PLANS.
//  - POST /refunds {payment_id, reason, items?: [{item_id: product_id, amount}]} → Refund. Refunds
//    can sit in `pending` or `review` before they succeed; the entitlement is revoked by the
//    refund.succeeded webhook, not here.

export const DODO_API_URL: Record<DodoEnvironment, string> = {
  test_mode: "https://test.dodopayments.com",
  live_mode: "https://live.dodopayments.com",
};

export interface DodoOptions {
  environment: DodoEnvironment;
  apiKey: string;
  webhookKey: string;
  products: Record<ProductKind, string>;
  webhookToleranceSeconds?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

const REFUND_STATUS: Record<z.output<typeof RefundResponse>["status"], RefundResult["status"]> = {
  succeeded: "approved",
  failed: "rejected",
  pending: "pending_approval",
  review: "pending_approval",
};

export function createDodoPayments(options: DodoOptions): PaymentsProvider {
  const { environment, apiKey, webhookKey, products } = options;
  const doFetch = options.fetch ?? fetch;
  const baseUrl = DODO_API_URL[environment];

  async function call<T extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    schema: T,
    body?: unknown,
  ): Promise<z.output<T>> {
    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ApiErrorBody.safeParse(json);
      const code = error.success ? (error.data.code ?? null) : null;
      const message = error.success ? error.data.message : undefined;
      throw new PaymentsApiError(
        `Dodo ${method} ${path} failed with ${response.status}${code ? ` (${code})` : ""}${message ? `: ${message}` : ""}.`,
        response.status,
        code,
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success)
      throw new PaymentsApiError(
        `Dodo ${method} ${path} returned an unexpected body: ${parsed.error.message}`,
        response.status,
        null,
      );
    return parsed.data;
  }

  return {
    name: "dodo",

    async createCheckout(input) {
      const product = checkCheckoutInput(input);
      const session = await call("POST", "/checkouts", CheckoutSessionResponse, {
        product_cart: [{ product_id: products[product.kind], quantity: 1 }],
        customer: { email: input.customerEmail },
        return_url: input.successUrl,
        metadata: {
          user_id: input.userId,
          school_cycle_id: product.schoolCycleId,
          product_key: input.productKey,
        },
        ...(input.discountCode ? { discount_codes: [input.discountCode] } : {}),
      });
      return {
        checkoutId: session.session_id,
        clientConfig: {
          provider: "dodo",
          mode: environment === "live_mode" ? "live" : "test",
          checkoutUrl: session.checkout_url,
          sessionId: session.session_id,
        },
      };
    },

    verifyWebhook(rawBody, headers) {
      return verifySignedWebhook(rawBody, headers, {
        secret: webhookKey,
        ...(options.webhookToleranceSeconds === undefined
          ? {}
          : { toleranceSeconds: options.webhookToleranceSeconds }),
        ...(options.now ? { now: options.now } : {}),
      });
    },

    parseEvent: mapDodoEvent,

    async refund(input) {
      const body = await refundBody(input, async () => {
        const payment = await call(
          "GET",
          `/payments/${encodeURIComponent(input.providerTxnId)}`,
          PaymentProductsResponse,
        );
        // A school kit or pack payment has exactly one product.
        const item = payment.product_cart?.[0];
        if (!item) throw new PaymentsApiError("The payment has no products.", 200, null);
        return item.product_id;
      });
      const refund = await call("POST", "/refunds", RefundResponse, body);
      return { adjustmentId: refund.refund_id, status: REFUND_STATUS[refund.status] };
    },
  };
}

/** Validates a checkout request; returns the parsed product key. Shared with the fake. */
export function checkCheckoutInput(
  input: CheckoutInput,
): NonNullable<ReturnType<typeof parseProductKey>> {
  const product = parseProductKey(input.productKey);
  if (!product) throw new PaymentsConfigError(`Unknown product key "${input.productKey}".`);
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0)
    throw new PaymentsConfigError("priceCents must be a positive whole number of cents.");
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new PaymentsConfigError("currency must be an upper-case ISO 4217 code.");
  if (!input.userId) throw new PaymentsConfigError("userId is required.");
  // The overlay redirects to return_url after payment; a relative one fails there, after paying.
  if (!/^https?:\/\/[^/]/.test(input.successUrl))
    throw new PaymentsConfigError("successUrl must be an absolute http(s) URL.");
  return product;
}

/** The POST /refunds body: a full refund, or a partial one against the kit's product. */
export async function refundBody(
  input: RefundInput,
  productId: () => Promise<string>,
): Promise<Record<string, unknown>> {
  const reason = input.note ? `${input.reason}: ${input.note}` : input.reason;
  if (input.amountCents === undefined) return { payment_id: input.providerTxnId, reason };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new PaymentsConfigError("A partial refund needs a positive whole number of cents.");
  return {
    payment_id: input.providerTxnId,
    reason,
    items: [{ item_id: await productId(), amount: input.amountCents }],
  };
}
