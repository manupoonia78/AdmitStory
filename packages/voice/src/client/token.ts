// POST /api/stt/token (spec §11): one single-use, 60-second Deepgram key per connection. A refusal
// (unverified email, free voice minutes used, STT down) is an outcome the Studio shows as a state;
// anything else that fails throws, and the dictation session retries with backoff.

import type { SttRefusal, SttTokenResponse } from "../contract";
import type { SttTokenOutcome } from "./dictation";

const REFUSALS: readonly SttRefusal[] = [
  "email_unverified",
  "voice_minutes_used",
  "stt_unavailable",
];

const isRefusal = (value: unknown): value is SttRefusal =>
  typeof value === "string" && (REFUSALS as readonly string[]).includes(value);

/** Reads a /api/stt/token response body: a token, a refusal, or null when it is neither. */
export function readSttTokenBody(body: unknown): SttTokenOutcome | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  if (isRefusal(record.refusal)) return { refusal: record.refusal };
  if (
    typeof record.url === "string" &&
    Array.isArray(record.protocols) &&
    record.protocols.every((p) => typeof p === "string") &&
    typeof record.remainingSeconds === "number"
  )
    return record as unknown as SttTokenResponse;
  return null;
}

export function fetchSttToken(
  options: { endpoint?: string; body?: Record<string, unknown>; fetch?: typeof fetch } = {},
): Promise<SttTokenOutcome> {
  const { endpoint = "/api/stt/token", body = {}, fetch: fetchImpl = globalThis.fetch } = options;
  return fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (response) => {
    const outcome = readSttTokenBody(await response.json().catch(() => null));
    if (outcome && ("refusal" in outcome || response.ok)) return outcome;
    throw new Error(`STT token request failed: ${response.status}`);
  });
}
