import { randomUUID } from "node:crypto";

// Voice unit costs (spec §12.2) and the usage_ledger rows they produce. Both rates are the spec's
// estimates — verify against the vendors' invoices in beta, as §12.2 says. The fakes cost nothing
// but still record seconds and characters, so metering is exercised in development.

export const VOICE_RATES = {
  /** verify: Deepgram streaming, USD per minute of audio. */
  sttPerMinute: { deepgram: 0.0048, fake: 0 },
  /** verify: §12.2 assumes $0.03–0.05 per 1K characters; the midpoint until invoices say otherwise. */
  ttsPer1kChars: { cartesia: 0.04, elevenlabs: 0.04, fake: 0 },
} as const;

export type SttProviderName = keyof typeof VOICE_RATES.sttPerMinute;
export type TtsProviderNameWithFake = keyof typeof VOICE_RATES.ttsPer1kChars;

const usd = (value: number) => Number(value.toFixed(5));

export const sttCostUsd = (provider: SttProviderName, seconds: number): number =>
  usd((Math.max(0, seconds) / 60) * VOICE_RATES.sttPerMinute[provider]);

export const ttsCostUsd = (provider: TtsProviderNameWithFake, chars: number): number =>
  usd((Math.max(0, chars) / 1000) * VOICE_RATES.ttsPer1kChars[provider]);

/** A voice usage_ledger row; structurally the db package's VoiceUsageEntry. */
export interface VoiceLedgerEntry {
  runId: string;
  userId: string;
  task: "voice.stt" | "voice.tts";
  /** The provider name, which is what a voice row's `model` means. */
  model: string;
  sttSeconds: number;
  ttsChars: number;
  costUsd: number;
  latencyMs: number;
  aiMode: "live" | "replay";
}

export function sttLedgerEntry(
  userId: string,
  provider: SttProviderName,
  seconds: number,
): VoiceLedgerEntry {
  return {
    runId: randomUUID(),
    userId,
    task: "voice.stt",
    model: provider,
    sttSeconds: Number(Math.max(0, seconds).toFixed(2)),
    ttsChars: 0,
    costUsd: sttCostUsd(provider, seconds),
    latencyMs: 0,
    // `replay` marks a row no vendor will bill for, as it does for the language models.
    aiMode: provider === "fake" ? "replay" : "live",
  };
}

export function ttsLedgerEntry(
  userId: string,
  provider: TtsProviderNameWithFake,
  chars: number,
  latencyMs: number,
): VoiceLedgerEntry {
  return {
    runId: randomUUID(),
    userId,
    task: "voice.tts",
    model: provider,
    sttSeconds: 0,
    ttsChars: Math.max(0, Math.round(chars)),
    costUsd: ttsCostUsd(provider, chars),
    latencyMs: Math.max(0, Math.round(latencyMs)),
    aiMode: provider === "fake" ? "replay" : "live",
  };
}
