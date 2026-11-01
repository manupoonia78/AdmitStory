import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { openCheckout, resetPaddleClient, type PaddleJs, type PaddleJsEvent } from "../src/client";
import { parsePaymentsEnv } from "../src/env";
import { buildSignedFakeWebhook, createFakePayments, FAKE_WEBHOOK_SECRET } from "../src/fake";
import { createPaddlePayments, PADDLE_API_URL } from "../src/paddle";
import {
  PaymentsApiError,
  PaymentsConfigError,
  schoolKitProductKey,
  WebhookPayloadError,
  WebhookVerificationError,
  type CheckoutInput,
} from "../src/provider";
import { selectPaymentsProvider } from "../src/select";
import { signatureHeader, verifySignedWebhook } from "../src/signature";

const SECRET = "pdl_ntfset_01jbx0000000000000000000000_testsecret";
const NOW = Date.parse("2026-10-31T09:14:08Z");
const now = () => NOW;
const ts = Math.floor(NOW / 1000);

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8");

const CYCLE = "6f1c2d3e-4a5b-4c6d-8e7f-90a1b2c3d4e5";
const USER = "00000000-0000-4000-8000-000000000001";

const checkoutInput: CheckoutInput = {
  userId: USER,
  productKey: schoolKitProductKey(CYCLE),
  priceCents: 10_000,
  currency: "USD",
  customerEmail: "applicant@example.com",
  successUrl: "http://localhost:3000/kits/k1",
};

const paddle = (fetchImpl?: typeof fetch, extra: { schoolKitPriceId?: string } = {}) =>
  createPaddlePayments({
    environment: "sandbox",
    apiKey: "pdl_sdbx_apikey_test",
    webhookSecret: SECRET,
    clientToken: "test_clienttoken",
    now,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    ...extra,
  });

/** A fetch mock that answers each call in turn and records what was sent. */
function mockFetch(...responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] =
    [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  return { fetch: impl as unknown as typeof fetch, calls };
}

const verifyError = (fn: () => unknown): WebhookVerificationError => {
  try {
    fn();
  } catch (error) {
    if (error instanceof WebhookVerificationError) return error;
    throw error;
  }
  throw new Error("expected a WebhookVerificationError");
};

describe("Paddle webhook signatures (§14.6)", () => {
  const body = fixture("transaction-completed");
  const header = signatureHeader(SECRET, body, ts);

  it("accepts the exact body signed as ts:body with HMAC-SHA256, from a Headers object or a record", () => {
    expect(header).toMatch(/^ts=\d+;h1=[0-9a-f]{64}$/);
    const fromHeaders = verifySignedWebhook(body, new Headers({ "Paddle-Signature": header }), {
      secret: SECRET,
      now,
    });
    expect(fromHeaders).toMatchObject({
      eventId: "evt_01jbx7k2m3n4p5q6r7s8t9v0wa",
      eventType: "transaction.completed",
      occurredAt: "2026-10-31T09:14:07.123456Z",
    });
    const fromRecord = verifySignedWebhook(
      body,
      { "Paddle-Signature": [header] },
      { secret: SECRET, now },
    );
    expect(fromRecord.eventId).toBe(fromHeaders.eventId);
  });

  it("rejects a tampered body, even whitespace", () => {
    const tampered = body.replace('"10000"', '"1"');
    expect(
      verifyError(() => paddle().verifyWebhook(tampered, { "paddle-signature": header })).code,
    ).toBe("mismatch");
    expect(
      verifyError(() => paddle().verifyWebhook(`${body} `, { "paddle-signature": header })).code,
    ).toBe("mismatch");
  });

  it("rejects a signature made with another secret", () => {
    const wrong = signatureHeader("another_secret", body, ts);
    expect(
      verifyError(() => paddle().verifyWebhook(body, { "paddle-signature": wrong })).code,
    ).toBe("mismatch");
  });

  it("rejects timestamps outside the tolerance (default 5 minutes, configurable)", () => {
    const old = signatureHeader(SECRET, body, ts - 301);
    const future = signatureHeader(SECRET, body, ts + 301);
    expect(verifyError(() => paddle().verifyWebhook(body, { "paddle-signature": old })).code).toBe(
      "stale",
    );
    expect(
      verifyError(() => paddle().verifyWebhook(body, { "paddle-signature": future })).code,
    ).toBe("stale");
    expect(() =>
      paddle().verifyWebhook(body, { "paddle-signature": signatureHeader(SECRET, body, ts - 299) }),
    ).not.toThrow();
    const strict = createPaddlePayments({
      environment: "sandbox",
      apiKey: "k",
      webhookSecret: SECRET,
      clientToken: "test_t",
      webhookToleranceSeconds: 5,
      now,
    });
    const sixSeconds = signatureHeader(SECRET, body, ts - 6);
    expect(
      verifyError(() => strict.verifyWebhook(body, { "paddle-signature": sixSeconds })).code,
    ).toBe("stale");
  });

  it.each([
    ["", "missing_signature"],
    ["h1=" + "a".repeat(64), "malformed_signature"],
    [`ts=${ts}`, "malformed_signature"],
    [`ts=${ts};h1=nothex`, "malformed_signature"],
    [`ts=abc;h1=${"a".repeat(64)}`, "malformed_signature"],
    [`ts=${ts};ts=${ts};h1=${"a".repeat(64)}`, "malformed_signature"],
    ["garbage", "malformed_signature"],
  ])("rejects the header %j as %s", (value, code) => {
    const headers = value ? { "paddle-signature": value } : {};
    expect(verifyError(() => paddle().verifyWebhook(body, headers)).code).toBe(code);
  });

  it("accepts any matching h1 during secret rotation and ignores unknown keys", () => {
    const rotated = `ts=${ts};h1=${"0".repeat(64)};h1=${header.split("h1=")[1]};h2=future`;
    expect(paddle().verifyWebhook(body, { "paddle-signature": rotated }).eventType).toBe(
      "transaction.completed",
    );
  });

  it("fails closed on an empty secret", () => {
    expect(() =>
      verifySignedWebhook(
        body,
        { "paddle-signature": signatureHeader("", body, ts) },
        { secret: "", now },
      ),
    ).toThrow(PaymentsConfigError);
  });

  it("verifies the signature before looking at the body", () => {
    const notJson = "not json";
    expect(
      verifyError(() => paddle().verifyWebhook(notJson, { "paddle-signature": header })).code,
    ).toBe("mismatch");
    const signed = signatureHeader(SECRET, notJson, ts);
    expect(
      verifyError(() => paddle().verifyWebhook(notJson, { "paddle-signature": signed })).code,
    ).toBe("malformed_body");
    const noEnvelope = '{"data":{}}';
    expect(() =>
      paddle().verifyWebhook(noEnvelope, {
        "paddle-signature": signatureHeader(SECRET, noEnvelope, ts),
      }),
    ).toThrow(WebhookPayloadError);
  });
});

describe("Paddle event mapping (§13)", () => {
  const provider = paddle();
  const event = (name: string, edit?: (payload: { data: Record<string, unknown> }) => void) => {
    const payload = JSON.parse(fixture(name)) as { data: Record<string, unknown> };
    edit?.(payload);
    const body = JSON.stringify(payload);
    return provider.parseEvent(
      provider.verifyWebhook(body, { "paddle-signature": signatureHeader(SECRET, body, ts) }),
    );
  };

  it("maps transaction.completed to a purchase with our custom data and the total paid", () => {
    const mapped = event("transaction-completed");
    expect(mapped).toMatchObject({
      type: "purchase_completed",
      eventId: "evt_01jbx7k2m3n4p5q6r7s8t9v0wa",
      providerTxnId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      productKey: `school_kit:${CYCLE}`,
      userId: USER,
      schoolCycleId: CYCLE,
      amountCents: 10_000,
      currency: "USD",
      discountId: null,
    });
    expect((mapped as { raw: { event_type: string } }).raw.event_type).toBe(
      "transaction.completed",
    );
  });

  it("reports what the buyer paid after a discount, in their currency", () => {
    const mapped = event("transaction-completed", ({ data }) => {
      data.discount_id = "dsc_01jbx0launch0000000000000";
      data.currency_code = "EUR";
      data.details = { totals: { total: "7400", grand_total: "7400", currency_code: "EUR" } };
    });
    expect(mapped).toMatchObject({
      amountCents: 7_400,
      currency: "EUR",
      discountId: "dsc_01jbx0launch0000000000000",
    });
  });

  it("ignores a completed transaction without our custom data, saying admin should know", () => {
    const mapped = event("transaction-completed", ({ data }) => {
      data.custom_data = null;
    });
    expect(mapped).toMatchObject({
      type: "ignored",
      eventType: "transaction.completed",
      alertAdmin: true,
      reason: "Completed transaction txn_01jbx7f0a1b2c3d4e5f6g7h8j9 has no AdmitStory custom data.",
    });
  });

  it("grants nothing for custom data whose product key names another school cycle or product, and alerts admin instead of failing the webhook", () => {
    for (const product_key of ["school_kit:another-cycle", "expert_session:e1"])
      expect(
        event("transaction-completed", ({ data }) => {
          data.custom_data = { user_id: USER, school_cycle_id: CYCLE, product_key };
        }),
      ).toMatchObject({
        type: "ignored",
        alertAdmin: true,
        reason: expect.stringContaining("inconsistent custom data"),
      });
  });

  it("refuses an invalid payload (fractional amount, bad id)", () => {
    expect(() =>
      event("transaction-completed", ({ data }) => {
        data.details = { totals: { total: "100.50", currency_code: "USD" } };
      }),
    ).toThrow(WebhookPayloadError);
    expect(() =>
      event("transaction-completed", ({ data }) => {
        data.id = "order-1";
      }),
    ).toThrow(WebhookPayloadError);
  });

  it("maps transaction.payment_failed with the decline code", () => {
    expect(event("transaction-payment-failed")).toMatchObject({
      type: "payment_failed",
      providerTxnId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      userId: USER,
      productKey: `school_kit:${CYCLE}`,
      errorCode: "declined",
    });
  });

  it("waits for a refund's approval: pending is ignored, approved revokes", () => {
    expect(event("adjustment-created-pending")).toMatchObject({
      type: "ignored",
      alertAdmin: false,
      reason: "Refund adj_01jbz2a0a1b2c3d4e5f6g7h8j9 is pending_approval.",
    });
    expect(event("adjustment-updated-approved")).toMatchObject({
      type: "refund_completed",
      providerTxnId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      adjustmentId: "adj_01jbz2a0a1b2c3d4e5f6g7h8j9",
      kind: "refund",
      partial: false,
      amountCents: 10_000,
      currency: "USD",
    });
    expect(
      event("adjustment-updated-approved", ({ data }) => {
        data.type = "partial";
        data.totals = { total: "2500", currency_code: "USD" };
      }),
    ).toMatchObject({ type: "refund_completed", partial: true, amountCents: 2_500 });
    expect(
      event("adjustment-updated-approved", ({ data }) => {
        data.action = "credit";
      }),
    ).toMatchObject({ type: "ignored", alertAdmin: false });
  });

  it("revokes on an approved chargeback and asks a person about a reversed one", () => {
    expect(
      event("adjustment-updated-approved", (payload) => {
        (payload as unknown as { event_type: string }).event_type = "adjustment.created";
        payload.data.action = "chargeback";
      }),
    ).toMatchObject({ type: "refund_completed", kind: "chargeback", partial: false });
    expect(
      event("adjustment-updated-approved", ({ data }) => {
        data.action = "chargeback_reverse";
      }),
    ).toMatchObject({ type: "ignored", alertAdmin: true });
    // A prototype key is just another unknown action.
    expect(
      event("adjustment-updated-approved", ({ data }) => {
        data.action = "constructor";
      }),
    ).toMatchObject({ type: "ignored", alertAdmin: false });
  });

  it("acknowledges other event types without acting", () => {
    expect(
      event("transaction-completed", (payload) => {
        (payload as unknown as { event_type: string }).event_type = "transaction.created";
      }),
    ).toMatchObject({
      type: "ignored",
      alertAdmin: false,
      reason: "transaction.created is not handled.",
    });
  });
});

describe("Paddle API requests (§13)", () => {
  it("creates a transaction with a non-catalog price and our custom data, then hands the browser its id", async () => {
    const { fetch, calls } = mockFetch({
      status: 201,
      body: { data: { id: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9", status: "draft" } },
    });
    const session = await paddle(fetch).createCheckout({
      ...checkoutInput,
      discountCode: "LAUNCH20",
      label: "Fictional School of Management School Kit",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: `${PADDLE_API_URL.sandbox}/transactions`,
      method: "POST",
      headers: { Authorization: "Bearer pdl_sdbx_apikey_test", "Content-Type": "application/json" },
      body: {
        items: [
          {
            quantity: 1,
            price: {
              unit_price: { amount: "10000", currency_code: "USD" },
              product: {
                name: "Fictional School of Management School Kit",
                tax_category: "standard",
              },
            },
          },
        ],
        currency_code: "USD",
        collection_mode: "automatic",
        custom_data: { user_id: USER, school_cycle_id: CYCLE, product_key: `school_kit:${CYCLE}` },
      },
    });
    expect(session).toEqual({
      checkoutId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      clientConfig: {
        provider: "paddle",
        environment: "sandbox",
        clientToken: "test_clienttoken",
        transactionId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
        customerEmail: "applicant@example.com",
        successUrl: "http://localhost:3000/kits/k1",
        discountCode: "LAUNCH20",
      },
    });
    expect(JSON.stringify(session)).not.toContain("pdl_sdbx_apikey_test");
  });

  it("uses the catalog price when PADDLE_PRICE_SCHOOL_KIT is set", async () => {
    const { fetch, calls } = mockFetch({
      body: { data: { id: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9", status: "draft" } },
    });
    await paddle(fetch, { schoolKitPriceId: "pri_01jbx6z9a1b2c3d4e5f6g7h8j9" }).createCheckout(
      checkoutInput,
    );
    expect((calls[0]!.body as { items: unknown[] }).items).toEqual([
      { price_id: "pri_01jbx6z9a1b2c3d4e5f6g7h8j9", quantity: 1 },
    ]);
  });

  it("rejects bad checkout input before calling Paddle", async () => {
    const { fetch, calls } = mockFetch();
    const provider = paddle(fetch);
    await expect(provider.createCheckout({ ...checkoutInput, priceCents: 99.5 })).rejects.toThrow(
      PaymentsConfigError,
    );
    await expect(provider.createCheckout({ ...checkoutInput, currency: "usd" })).rejects.toThrow(
      PaymentsConfigError,
    );
    await expect(
      provider.createCheckout({ ...checkoutInput, successUrl: "/kits/k1" }),
    ).rejects.toThrow(PaymentsConfigError);
    await expect(
      provider.createCheckout({
        ...checkoutInput,
        productKey: "school_kit:" as `school_kit:${string}`,
      }),
    ).rejects.toThrow(PaymentsConfigError);
    expect(calls).toHaveLength(0);
  });

  it("surfaces Paddle's error code without the key", async () => {
    const { fetch } = mockFetch({
      status: 403,
      body: {
        error: { type: "request_error", code: "forbidden", detail: "You aren't permitted." },
      },
    });
    const failure = await paddle(fetch)
      .createCheckout(checkoutInput)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PaymentsApiError);
    expect(failure).toMatchObject({ status: 403, code: "forbidden" });
    expect(String(failure)).not.toContain("apikey");
  });

  it("asks for a full refund with the reason code", async () => {
    const { fetch, calls } = mockFetch({
      status: 201,
      body: { data: { id: "adj_01jbz2a0a1b2c3d4e5f6g7h8j9", status: "pending_approval" } },
    });
    const result = await paddle(fetch).refund({
      providerTxnId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      reason: "pipeline_failed",
    });
    expect(calls).toEqual([
      expect.objectContaining({
        url: `${PADDLE_API_URL.sandbox}/adjustments`,
        method: "POST",
        body: {
          action: "refund",
          transaction_id: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
          reason: "pipeline_failed",
          type: "full",
        },
      }),
    ]);
    expect(result).toEqual({
      adjustmentId: "adj_01jbz2a0a1b2c3d4e5f6g7h8j9",
      status: "pending_approval",
    });
  });

  it("refunds part of the kit's line item, looked up from the transaction", async () => {
    const { fetch, calls } = mockFetch(
      {
        body: {
          data: {
            id: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
            details: { line_items: [{ id: "txnitm_01jbx7f0k1m2n3p4q5r6s7t8v9" }] },
          },
        },
      },
      { status: 201, body: { data: { id: "adj_01jbz2a0a1b2c3d4e5f6g7h8j9", status: "approved" } } },
    );
    await paddle(fetch).refund({
      providerTxnId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      reason: "goodwill",
      amountCents: 2_500,
      note: "late kit",
    });
    expect(calls[0]).toMatchObject({
      url: `${PADDLE_API_URL.sandbox}/transactions/txn_01jbx7f0a1b2c3d4e5f6g7h8j9`,
      method: "GET",
    });
    expect(calls[1]!.body).toEqual({
      action: "refund",
      transaction_id: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      reason: "goodwill: late kit",
      type: "partial",
      items: [{ item_id: "txnitm_01jbx7f0k1m2n3p4q5r6s7t8v9", type: "partial", amount: "2500" }],
    });
  });

  it("rejects a partial refund that isn't a positive whole number of cents", async () => {
    const { fetch, calls } = mockFetch();
    await expect(
      paddle(fetch).refund({
        providerTxnId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
        reason: "other",
        amountCents: 0,
      }),
    ).rejects.toThrow(PaymentsConfigError);
    expect(calls).toHaveLength(0);
  });
});

describe("Fake provider (localhost only)", () => {
  const local = "http://localhost:3000";

  it("refuses to run when APP_URL isn't localhost", () => {
    expect(() => createFakePayments({ appUrl: "https://admitstory.example" })).toThrow(
      PaymentsConfigError,
    );
    expect(() => createFakePayments({ appUrl: undefined })).toThrow(PaymentsConfigError);
    expect(() => createFakePayments({ appUrl: "http://127.0.0.1:3000" })).not.toThrow();
  });

  it("round-trips a checkout through the real signature check and event mapping, with deterministic ids", async () => {
    const fake = createFakePayments({ appUrl: local, now });
    const session = await fake.createCheckout(checkoutInput);
    expect(session.checkoutId).toMatch(/^txn_[0-9a-f]{26}$/);
    expect(
      (await createFakePayments({ appUrl: local, now }).createCheckout(checkoutInput)).checkoutId,
    ).toBe(session.checkoutId);
    expect(session.clientConfig).toMatchObject({
      provider: "fake",
      amountCents: 10_000,
      currency: "USD",
    });

    const { body, headers } = fake.completeCheckout(session.checkoutId);
    expect(headers["paddle-signature"]).toMatch(/^ts=\d+;h1=[0-9a-f]{64}$/);
    // The same bytes pass the shared verifier with the fake's secret, and fail Paddle's.
    expect(() =>
      verifySignedWebhook(body, headers, { secret: FAKE_WEBHOOK_SECRET, now }),
    ).not.toThrow();
    expect(verifyError(() => paddle().verifyWebhook(body, headers)).code).toBe("mismatch");

    const event = fake.parseEvent(fake.verifyWebhook(body, headers));
    expect(event).toMatchObject({
      type: "purchase_completed",
      providerTxnId: session.checkoutId,
      userId: USER,
      schoolCycleId: CYCLE,
      productKey: `school_kit:${CYCLE}`,
      amountCents: 10_000,
      currency: "USD",
    });
    // A replay is the same event (the app's idempotency key is the transaction id).
    const replay = fake.parseEvent(fake.verifyWebhook(body, headers));
    expect(replay).toMatchObject({
      eventId: (event as { eventId: string }).eventId,
      providerTxnId: session.checkoutId,
    });
  });

  it("sends a decline and an approved refund the same way", async () => {
    const fake = createFakePayments({ appUrl: local, now });
    const { checkoutId } = await fake.createCheckout(checkoutInput);
    const declined = fake.completeCheckout(checkoutId, "declined");
    expect(fake.parseEvent(fake.verifyWebhook(declined.body, declined.headers))).toMatchObject({
      type: "payment_failed",
      errorCode: "declined",
      userId: USER,
    });

    const refund = await fake.refund({
      providerTxnId: checkoutId,
      reason: "requested_by_customer",
    });
    expect(refund).toMatchObject({
      status: "approved",
      adjustmentId: expect.stringMatching(/^adj_/),
    });
    const webhook = fake.refundWebhook(refund.adjustmentId);
    expect(fake.parseEvent(fake.verifyWebhook(webhook.body, webhook.headers))).toMatchObject({
      type: "refund_completed",
      providerTxnId: checkoutId,
      adjustmentId: refund.adjustmentId,
      kind: "refund",
      partial: false,
      amountCents: 10_000,
    });
    const part = await fake.refund({
      providerTxnId: checkoutId,
      reason: "goodwill",
      amountCents: 2_500,
    });
    const partWebhook = fake.refundWebhook(part.adjustmentId);
    expect(
      fake.parseEvent(fake.verifyWebhook(partWebhook.body, partWebhook.headers)),
    ).toMatchObject({ type: "refund_completed", partial: true, amountCents: 2_500 });
    expect(() => fake.completeCheckout("txn_unknown")).toThrow(PaymentsConfigError);
  });

  it("builds a signed webhook for any event, with a stale signature failing like Paddle's", () => {
    const old = buildSignedFakeWebhook(
      {
        type: "purchase_completed",
        transactionId: "txn_0123456789abcdef0123456789",
        userId: USER,
        productKey: schoolKitProductKey(CYCLE),
        amountCents: 10_000,
        currency: "USD",
      },
      { now: () => NOW - 10 * 60_000 },
    );
    const fake = createFakePayments({ appUrl: local, now });
    expect(verifyError(() => fake.verifyWebhook(old.body, old.headers)).code).toBe("stale");
  });
});

describe("Provider selection and environment", () => {
  const keys = {
    PADDLE_API_KEY: "pdl_sdbx_apikey_x",
    PADDLE_WEBHOOK_SECRET: "pdl_ntfset_x",
    PADDLE_CLIENT_TOKEN: "test_x",
  };

  it("picks Paddle when its keys are set, wherever the app runs", () => {
    const env = parsePaymentsEnv({ ...keys, APP_URL: "https://admitstory.example" });
    expect(selectPaymentsProvider(env).name).toBe("paddle");
  });

  it("picks the fake on localhost without keys, and refuses elsewhere", () => {
    expect(
      selectPaymentsProvider(parsePaymentsEnv({ APP_URL: "http://localhost:3000" })).name,
    ).toBe("fake");
    expect(() =>
      selectPaymentsProvider(parsePaymentsEnv({ APP_URL: "https://admitstory.example" })),
    ).toThrow(/only when APP_URL is localhost/);
  });

  it("parses the environment and catches half or mismatched configuration", () => {
    expect(parsePaymentsEnv({})).toMatchObject({ paddleEnv: "sandbox", paddleApiKey: undefined });
    expect(parsePaymentsEnv({ PADDLE_ENV: "production" }).paddleEnv).toBe("live");
    expect(
      parsePaymentsEnv({ ...keys, PADDLE_PRICE_SCHOOL_KIT: " pri_01abc " }).paddlePriceSchoolKit,
    ).toBe("pri_01abc");
    expect(() => parsePaymentsEnv({ PADDLE_ENV: "staging" })).toThrow(PaymentsConfigError);
    expect(() => parsePaymentsEnv({ PADDLE_API_KEY: "pdl_sdbx_apikey_x" })).toThrow(/together/);
    expect(() => parsePaymentsEnv({ ...keys, PADDLE_PRICE_SCHOOL_KIT: "10000" })).toThrow(/pri_/);
    expect(() => parsePaymentsEnv({ ...keys, PADDLE_ENV: "live" })).toThrow(
      /PADDLE_API_KEY is not a live key/,
    );
    expect(() =>
      parsePaymentsEnv({ ...keys, PADDLE_API_KEY: "pdl_live_apikey_x", PADDLE_ENV: "live" }),
    ).toThrow(/PADDLE_CLIENT_TOKEN is not a live token/);
  });
});

describe("Browser checkout", () => {
  function stubPaddle() {
    let callback: ((event: PaddleJsEvent) => void) | undefined;
    const paddleJs: PaddleJs = {
      Environment: { set: vi.fn() },
      Initialize: vi.fn((options) => {
        callback = options.eventCallback;
      }),
      Checkout: { open: vi.fn() },
    };
    return { paddleJs, emit: (event: PaddleJsEvent) => callback?.(event) };
  }

  it("returns the fake config for the app's local overlay without loading anything", async () => {
    const load = vi.fn();
    const config = {
      provider: "fake" as const,
      transactionId: "txn_x",
      productKey: schoolKitProductKey(CYCLE),
      amountCents: 10_000,
      currency: "USD",
      customerEmail: "applicant@example.com",
      successUrl: "/kits/k1",
    };
    expect(await openCheckout(config, {}, load)).toEqual({ kind: "local", config });
    expect(load).not.toHaveBeenCalled();
  });

  it("initializes Paddle.js once in sandbox and opens the overlay on our transaction", async () => {
    resetPaddleClient();
    const { paddleJs, emit } = stubPaddle();
    const config = {
      provider: "paddle" as const,
      environment: "sandbox" as const,
      clientToken: "test_clienttoken",
      transactionId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      customerEmail: "applicant@example.com",
      successUrl: "http://localhost:3000/kits/k1",
      discountCode: "LAUNCH20",
    };
    const onComplete = vi.fn();
    const onClose = vi.fn();
    expect(
      await openCheckout(config, { onComplete, onClose, theme: "dark" }, async () => paddleJs),
    ).toEqual({
      kind: "opened",
    });
    await openCheckout(config, { onComplete, onClose }, async () => paddleJs);
    expect(paddleJs.Environment.set).toHaveBeenCalledExactlyOnceWith("sandbox");
    expect(paddleJs.Initialize).toHaveBeenCalledOnce();
    expect(paddleJs.Checkout.open).toHaveBeenNthCalledWith(1, {
      transactionId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9",
      customer: { email: "applicant@example.com" },
      discountCode: "LAUNCH20",
      settings: {
        displayMode: "overlay",
        successUrl: "http://localhost:3000/kits/k1",
        theme: "dark",
      },
    });
    emit({
      name: "checkout.completed",
      data: { transaction_id: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9" },
    });
    emit({ name: "checkout.closed" });
    expect(onComplete).toHaveBeenCalledWith({ transactionId: "txn_01jbx7f0a1b2c3d4e5f6g7h8j9" });
    expect(onClose).toHaveBeenCalledOnce();
    resetPaddleClient();
  });
});
