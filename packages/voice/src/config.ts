import type { TtsVoice } from "./contract";

// Vendor settings in one place (spec Appendix K: re-verify at build time). Checked against the
// vendors' docs on 31 October 2026; every value marked "verify" must be checked again before launch.
// These are speech vendors' model names, not language models: nothing here goes through ai.run().

export const DEEPGRAM = {
  grantUrl: "https://api.deepgram.com/v1/auth/grant",
  listenUrl: "wss://api.deepgram.com/v1/listen",
  /** verify: Nova-3 is the model that supports keyterm prompting and `language=multi`. */
  model: "nova-3",
  /** Deepgram: UtteranceEnd is useless below 1,000 ms because interim results arrive each second. */
  minUtteranceEndMs: 1_000,
  /** Deepgram: endpointing of 100 ms is recommended for code-switching (`language=multi`). */
  endpointingMs: { monolingual: 300, multi: 100 },
  /**
   * Deepgram: at most 500 tokens across all keyterms, and 20–50 terms is the useful range. We cap
   * by count and by characters (a token is never shorter than a character), which keeps us inside
   * the token limit without a tokenizer.
   */
  maxKeyterms: 50,
  maxKeytermChars: 1_200,
  maxKeytermLength: 60,
} as const;

export const CARTESIA = {
  url: "https://api.cartesia.ai/tts/sse",
  /** verify: the only accepted Cartesia-Version at the time of writing. */
  version: "2026-08-14",
  /** verify: latest stable Sonic model. */
  model: "sonic-3.6",
  /** generation_config.speed range. */
  speedRange: [0.6, 1.5],
} as const;

export const ELEVENLABS = {
  url: (voiceId: string) =>
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream/with-timestamps`,
  /** verify: the low-latency multilingual model. */
  model: "eleven_flash_v2_5",
  /** voice_settings.speed range. */
  speedRange: [0.7, 1.2],
} as const;

/**
 * Our three interviewer voices mapped to provider voice ids. Empty until Manu picks them in each
 * vendor's voice library (no id is guessed here); an adapter with an unmapped voice fails with a
 * message that points at this object.
 */
export const PROVIDER_VOICES: Record<"cartesia" | "elevenlabs", Record<TtsVoice, string>> = {
  cartesia: { warm: "", clear: "", low: "" },
  elevenlabs: { warm: "", clear: "", low: "" },
};

export function providerVoiceId(provider: "cartesia" | "elevenlabs", voice: TtsVoice): string {
  const id = PROVIDER_VOICES[provider][voice];
  if (!id)
    throw new Error(
      `No ${provider} voice is mapped to "${voice}". Set it in PROVIDER_VOICES (packages/voice/src/config.ts).`,
    );
  return id;
}

export const clampSpeed = (speed: number, [min, max]: readonly [number, number]): number =>
  Math.min(max, Math.max(min, speed));
