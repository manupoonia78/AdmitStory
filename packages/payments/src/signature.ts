import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookEnvelope } from "./schemas";
import {
  PaymentsConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
  type VerifiedWebhook,
  type WebhookHeaders,
} from "./provider";

// Paddle Billing webhook signatures (developer.paddle.com/webhooks/signature-verification, checked
// 31 October 2026): the `Paddle-Signature` header is `ts=<unix seconds>;h1=<hex HMAC-SHA256>`, the
// HMAC is over `${ts}:${rawBody}` keyed with the endpoint's secret key, and during secret rotation
// more than one h1 may be present. The fake provider signs with this same scheme, so local
// checkouts exercise this exact code path.

export const SIGNATURE_HEADER = "paddle-signature";

/**
 * Paddle's SDKs default to a 5-second tolerance. We allow 5 minutes so small clock skew on a
 * serverless host can't drop a real payment; replays inside the window are harmless because
 * purchases are idempotent on the transaction id (§5.6 AC).
 */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export function hmacHex(secret: string, timestamp: number | string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}:${rawBody}`, "utf8").digest("hex");
}

/** The header value Paddle would send for this body at this time. */
export function signatureHeader(secret: string, rawBody: string, timestampSeconds: number): string {
  return `ts=${timestampSeconds};h1=${hmacHex(secret, timestampSeconds, rawBody)}`;
}

export function headerValue(headers: WebhookHeaders, name: string): string | undefined {
  if (typeof (headers as Headers).get === "function")
    return (headers as Headers).get(name) ?? undefined;
  const record = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name);
  const found = key === undefined ? undefined : record[key];
  return Array.isArray(found) ? found[0] : found;
}

export function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 1) throw malformed();
    const key = part.slice(0, at).trim();
    const val = part.slice(at + 1).trim();
    if (key === "ts") {
      if (!/^\d{1,12}$/.test(val) || timestamp !== undefined) throw malformed();
      timestamp = Number(val);
    } else if (key === "h1") {
      if (!/^[0-9a-f]{64}$/i.test(val)) throw malformed();
      signatures.push(val.toLowerCase());
    }
    // Unknown keys are ignored, so a future signature scheme (h2…) doesn't break verification.
  }
  if (timestamp === undefined || signatures.length === 0) throw malformed();
  return { timestamp, signatures };
}

const malformed = () =>
  new WebhookVerificationError(
    "The Paddle-Signature header is not in the form ts=…;h1=….",
    "malformed_signature",
  );

export interface VerifyOptions {
  secret: string;
  toleranceSeconds?: number;
  now?: () => number;
}

/** Checks the signature over the exact raw body, then parses the event envelope. */
export function verifySignedWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  { secret, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS, now = Date.now }: VerifyOptions,
): VerifiedWebhook {
  // An empty key would make every forged signature computable; fail closed.
  if (!secret) throw new PaymentsConfigError("The webhook secret is empty.");
  const header = headerValue(headers, SIGNATURE_HEADER);
  if (!header)
    throw new WebhookVerificationError(
      "The Paddle-Signature header is missing.",
      "missing_signature",
    );
  const { timestamp, signatures } = parseSignatureHeader(header);

  if (Math.abs(Math.floor(now() / 1000) - timestamp) > toleranceSeconds)
    throw new WebhookVerificationError(
      `The webhook timestamp is more than ${toleranceSeconds} seconds from now.`,
      "stale",
    );

  const expected = Buffer.from(hmacHex(secret, timestamp, rawBody), "hex");
  const matches = signatures.some((signature) =>
    timingSafeEqual(Buffer.from(signature, "hex"), expected),
  );
  if (!matches)
    throw new WebhookVerificationError("The webhook signature does not match.", "mismatch");

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new WebhookVerificationError("The webhook body is not JSON.", "malformed_body");
  }
  const envelope = WebhookEnvelope.safeParse(json);
  if (!envelope.success)
    throw new WebhookPayloadError(`The webhook envelope is invalid: ${envelope.error.message}`);
  return {
    eventId: envelope.data.event_id,
    eventType: envelope.data.event_type,
    occurredAt: envelope.data.occurred_at,
    payload: json,
  };
}
