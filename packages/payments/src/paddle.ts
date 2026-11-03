import type { z } from "zod";
import { mapPaddleEvent } from "./events";
import {
  parseProductKey,
  PaymentsApiError,
  PaymentsConfigError,
  type CheckoutInput,
  type PaddleEnvironment,
  type PaymentsProvider,
  type RefundInput,
} from "./provider";
import {
  AdjustmentResponse,
  ApiErrorBody,
  CreatedTransactionResponse,
  TransactionLineItemsResponse,
} from "./schemas";
import { verifySignedWebhook } from "./signature";

// Paddle Billing adapter (spec §13), plain fetch, no SDK. Checked against developer.paddle.com on
// 31 October 2026:
//  - base URLs: https://sandbox-api.paddle.com and https://api.paddle.com; `Authorization: Bearer`.
//  - POST /transactions with items [{price_id, quantity}] or a non-catalog
//    {price: {description, name, unit_price: {amount, currency_code}, product: {name, tax_category}}}
//    and custom_data. The browser opens the overlay with that transaction's id (Paddle.js
//    `transactionId`), so custom_data is set by our server and can't be chosen by the buyer.
//    Paddle requires an approved default payment link (Checkout settings) for this to work.
//  - POST /adjustments {action: "refund", transaction_id, reason, type: "full" | "partial", items}.
//    Live refunds are usually `pending_approval` until Paddle reviews them; sandbox approves them
//    automatically every ten minutes.

export const PADDLE_API_URL: Record<PaddleEnvironment, string> = {
  sandbox: "https://sandbox-api.paddle.com",
  live: "https://api.paddle.com",
};

/** verify: "standard" is the tax category every Paddle account may use without approval. */
export const SCHOOL_KIT_TAX_CATEGORY = "standard";

export interface PaddleOptions {
  environment: PaddleEnvironment;
  apiKey: string;
  webhookSecret: string;
  clientToken: string;
  /** Catalog price for the school kit; without it, each checkout carries a non-catalog price. */
  schoolKitPriceId?: string;
  webhookToleranceSeconds?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

export function createPaddlePayments(options: PaddleOptions): PaymentsProvider {
  const { environment, apiKey, webhookSecret, clientToken, schoolKitPriceId } = options;
  const doFetch = options.fetch ?? fetch;
  const baseUrl = PADDLE_API_URL[environment];

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
      const code = error.success ? (error.data.error.code ?? null) : null;
      const detail = error.success ? error.data.error.detail : undefined;
      throw new PaymentsApiError(
        `Paddle ${method} ${path} failed with ${response.status}${code ? ` (${code})` : ""}${detail ? `: ${detail}` : ""}.`,
        response.status,
        code,
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success)
      throw new PaymentsApiError(
        `Paddle ${method} ${path} returned an unexpected body: ${parsed.error.message}`,
        response.status,
        null,
      );
    return parsed.data;
  }

  return {
    name: "paddle",

    async createCheckout(input) {
      const product = checkCheckoutInput(input);
      const item = schoolKitPriceId
        ? { price_id: schoolKitPriceId, quantity: 1 }
        : {
            quantity: 1,
            price: {
              description: input.productKey,
              name: "School kit",
              unit_price: { amount: String(input.priceCents), currency_code: input.currency },
              product: {
                name: input.label ?? "AdmitStory School Kit",
                tax_category: SCHOOL_KIT_TAX_CATEGORY,
              },
            },
          };
      const created = await call("POST", "/transactions", CreatedTransactionResponse, {
        items: [item],
        currency_code: input.currency,
        collection_mode: "automatic",
        custom_data: {
          user_id: input.userId,
          school_cycle_id: product.schoolCycleId,
          product_key: input.productKey,
        },
      });
      return {
        checkoutId: created.data.id,
        clientConfig: {
          provider: "paddle",
          environment,
          clientToken,
          transactionId: created.data.id,
          customerEmail: input.customerEmail,
          successUrl: input.successUrl,
          ...(input.discountCode ? { discountCode: input.discountCode } : {}),
        },
      };
    },

    verifyWebhook(rawBody, headers) {
      return verifySignedWebhook(rawBody, headers, {
        secret: webhookSecret,
        ...(options.webhookToleranceSeconds === undefined
          ? {}
          : { toleranceSeconds: options.webhookToleranceSeconds }),
        ...(options.now ? { now: options.now } : {}),
      });
    },

    parseEvent: mapPaddleEvent,

    async refund(input) {
      const body = await refundBody(input, async () => {
        const transaction = await call(
          "GET",
          `/transactions/${encodeURIComponent(input.providerTxnId)}`,
          TransactionLineItemsResponse,
        );
        // A school kit transaction has exactly one line item (the schema requires at least one).
        const [item] = transaction.data.details.line_items;
        if (!item) throw new PaymentsApiError("The transaction has no line items.", 200, null);
        return item.id;
      });
      const adjustment = await call("POST", "/adjustments", AdjustmentResponse, body);
      return { adjustmentId: adjustment.data.id, status: adjustment.data.status };
    },
  };
}

/** Validates a checkout request; returns the parsed product key. Shared with the fake. */
export function checkCheckoutInput(input: CheckoutInput): { schoolCycleId: string } {
  const product = parseProductKey(input.productKey);
  if (!product) throw new PaymentsConfigError(`Unknown product key "${input.productKey}".`);
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0)
    throw new PaymentsConfigError("priceCents must be a positive whole number of cents.");
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new PaymentsConfigError("currency must be an upper-case ISO 4217 code.");
  if (!input.userId) throw new PaymentsConfigError("userId is required.");
  // Paddle.js needs an absolute successUrl; a relative one fails inside the overlay, after payment.
  if (!/^https?:\/\/[^/]/.test(input.successUrl))
    throw new PaymentsConfigError("successUrl must be an absolute http(s) URL.");
  return product;
}

/** The POST /adjustments body: a full refund, or a partial one against the kit's line item. */
export async function refundBody(
  input: RefundInput,
  lineItemId: () => Promise<string>,
): Promise<Record<string, unknown>> {
  const reason = input.note ? `${input.reason}: ${input.note}` : input.reason;
  if (input.amountCents === undefined)
    return { action: "refund", transaction_id: input.providerTxnId, reason, type: "full" };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new PaymentsConfigError("A partial refund needs a positive whole number of cents.");
  return {
    action: "refund",
    transaction_id: input.providerTxnId,
    reason,
    type: "partial",
    items: [{ item_id: await lineItemId(), type: "partial", amount: String(input.amountCents) }],
  };
}
