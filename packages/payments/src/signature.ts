import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookEnvelope } from "./schemas";
import {
  PaymentsConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
  type VerifiedWebhook,
  type WebhookHeaders,
} from "./provider";

// Dodo Payments webhook signatures follow Standard Webhooks (docs.dodopayments.com/developer-
// resources/webhooks, checked 6 November 2026): headers `webhook-id`, `webhook-timestamp` (unix
// seconds) and `webhook-signature`, which holds one or more space-separated `v1,<base64>` values.
// Each is the base64 HMAC-SHA256 of `${id}.${timestamp}.${rawBody}`, keyed with the base64-decoded
// part of the endpoint's `whsec_…` secret. During a secret rotation both signatures are present.
// The fake provider signs with this same scheme, so local checkouts exercise this exact code path.

export const SIGNATURE_HEADER = "webhook-signature";
export const ID_HEADER = "webhook-id";
export const TIMESTAMP_HEADER = "webhook-timestamp";

/**
 * Standard Webhooks allows 5 minutes. Replays inside the window are harmless because events are
 * idempotent on the webhook id and purchases on the payment id (§5.6 AC).
 */
export const DEFAULT_TOLERANCE_SECONDS = 300;

function signingKey(secret: string): Buffer {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  // An empty key would make every forged signature computable; fail closed.
  if (key.length === 0) throw new PaymentsConfigError("The webhook secret is empty.");
  return key;
}

export function hmacBase64(
  secret: string,
  id: string,
  timestamp: number | string,
  rawBody: string,
) {
  return createHmac("sha256", signingKey(secret))
    .update(`${id}.${timestamp}.${rawBody}`, "utf8")
    .digest("base64");
}

/** The headers Dodo would send for this body, id and time. */
export function signatureHeaders(
  secret: string,
  id: string,
  rawBody: string,
  timestampSeconds: number,
): Record<string, string> {
  return {
    [ID_HEADER]: id,
    [TIMESTAMP_HEADER]: String(timestampSeconds),
    [SIGNATURE_HEADER]: `v1,${hmacBase64(secret, id, timestampSeconds, rawBody)}`,
  };
}

export function headerValue(headers: WebhookHeaders, name: string): string | undefined {
  if (typeof (headers as Headers).get === "function")
    return (headers as Headers).get(name) ?? undefined;
  const record = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name);
  const found = key === undefined ? undefined : record[key];
  return Array.isArray(found) ? found[0] : found;
}

/** The v1 signatures in a `webhook-signature` header, as raw bytes. */
export function parseSignatureHeader(header: string): Buffer[] {
  const signatures: Buffer[] = [];
  for (const part of header.trim().split(/\s+/)) {
    const comma = part.indexOf(",");
    if (comma < 1) throw malformed();
    // Unknown versions are skipped, so a future scheme (v1a…) doesn't break verification.
    if (part.slice(0, comma) !== "v1") continue;
    const value = part.slice(comma + 1);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw malformed();
    signatures.push(Buffer.from(value, "base64"));
  }
  if (signatures.length === 0) throw malformed();
  return signatures;
}

const malformed = () =>
  new WebhookVerificationError(
    "The webhook-signature header is not in the form v1,<base64>.",
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
  signingKey(secret);
  const id = headerValue(headers, ID_HEADER);
  const rawTimestamp = headerValue(headers, TIMESTAMP_HEADER);
  const header = headerValue(headers, SIGNATURE_HEADER);
  if (!id || !rawTimestamp || !header)
    throw new WebhookVerificationError(
      "The webhook-id, webhook-timestamp or webhook-signature header is missing.",
      "missing_signature",
    );
  if (!/^\d{1,12}$/.test(rawTimestamp)) throw malformed();
  const timestamp = Number(rawTimestamp);
  const signatures = parseSignatureHeader(header);

  if (Math.abs(Math.floor(now() / 1000) - timestamp) > toleranceSeconds)
    throw new WebhookVerificationError(
      `The webhook timestamp is more than ${toleranceSeconds} seconds from now.`,
      "stale",
    );

  const expected = Buffer.from(hmacBase64(secret, id, timestamp, rawBody), "base64");
  const matches = signatures.some(
    (signature) => signature.length === expected.length && timingSafeEqual(signature, expected),
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
    // Dodo keeps the webhook id across retries of one delivery, so it is the idempotency key.
    eventId: id,
    eventType: envelope.data.type,
    occurredAt: envelope.data.timestamp,
    payload: json,
  };
}
