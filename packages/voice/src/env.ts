// The voice environment (spec §17). Read on first use, never at import time. Parsed by hand rather
// than with Zod: this package has no dependencies, and these are five optional strings.
//
// A missing key is not an error: development and CI run on the fake providers, which select.ts
// picks automatically when the real provider's key is absent.

export type TtsProviderName = "cartesia" | "elevenlabs";

export interface VoiceEnv {
  deepgramApiKey: string | undefined;
  ttsProvider: TtsProviderName;
  cartesiaApiKey: string | undefined;
  elevenLabsApiKey: string | undefined;
  /** The local fake Deepgram server (packages/voice/src/testing/fake-deepgram.ts). */
  fakeSttUrl: string;
}

export const DEFAULT_FAKE_STT_URL = "ws://localhost:8787";

const value = (raw: string | undefined): string | undefined => {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
};

export function parseVoiceEnv(source: Record<string, string | undefined>): VoiceEnv {
  const provider = value(source.TTS_PROVIDER) ?? "cartesia";
  if (provider !== "cartesia" && provider !== "elevenlabs")
    throw new Error(`TTS_PROVIDER must be "cartesia" or "elevenlabs", not "${provider}".`);
  const fakeSttUrl = value(source.FAKE_STT_URL) ?? DEFAULT_FAKE_STT_URL;
  if (!/^wss?:\/\//.test(fakeSttUrl))
    throw new Error("FAKE_STT_URL must be a ws:// or wss:// URL.");
  return {
    deepgramApiKey: value(source.DEEPGRAM_API_KEY),
    ttsProvider: provider,
    cartesiaApiKey: value(source.CARTESIA_API_KEY),
    elevenLabsApiKey: value(source.ELEVENLABS_API_KEY),
    fakeSttUrl,
  };
}

let cached: VoiceEnv | undefined;

export function voiceEnv(): VoiceEnv {
  cached ??= parseVoiceEnv(process.env);
  return cached;
}

/** For tests that change the environment between cases. */
export function resetVoiceEnv(): void {
  cached = undefined;
}
