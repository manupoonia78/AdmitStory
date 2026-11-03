import { OPENAI_COMPAT_TTS } from "./config";

// The voice environment (spec §17). Read on first use, never at import time. Parsed by hand rather
// than with Zod: this package has no dependencies, and these are a handful of optional strings.
//
// A missing key is not an error: development and CI run on the fake providers, which select.ts
// picks automatically when the real provider's key is absent.

export const TTS_PROVIDER_NAMES = ["deepgram", "openai_compat", "cartesia", "elevenlabs"] as const;
export type TtsProviderName = (typeof TTS_PROVIDER_NAMES)[number];

export interface VoiceEnv {
  deepgramApiKey: string | undefined;
  ttsProvider: TtsProviderName;
  cartesiaApiKey: string | undefined;
  elevenLabsApiKey: string | undefined;
  /** openai_compat: the speech server (e.g. Kokoro-FastAPI) and its settings. */
  openAiTts: {
    baseUrl: string | undefined;
    apiKey: string | undefined;
    model: string;
    voices: Record<"warm" | "clear" | "low", string>;
  };
  /** The local fake Deepgram server (packages/voice/src/testing/fake-deepgram.ts). */
  fakeSttUrl: string;
}

export const DEFAULT_FAKE_STT_URL = "ws://localhost:8787";

const value = (raw: string | undefined): string | undefined => {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
};

export function parseVoiceEnv(source: Record<string, string | undefined>): VoiceEnv {
  const provider = value(source.TTS_PROVIDER) ?? "deepgram";
  if (!(TTS_PROVIDER_NAMES as readonly string[]).includes(provider))
    throw new Error(
      `TTS_PROVIDER must be one of ${TTS_PROVIDER_NAMES.join(", ")}, not "${provider}".`,
    );
  const voicesRaw = value(source.OPENAI_TTS_VOICES);
  let voices: Record<"warm" | "clear" | "low", string> = { ...OPENAI_COMPAT_TTS.defaultVoices };
  if (voicesRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(voicesRaw);
    } catch {
      throw new Error('OPENAI_TTS_VOICES must be JSON, e.g. {"warm":"af_heart"}.');
    }
    if (parsed && typeof parsed === "object")
      for (const key of ["warm", "clear", "low"] as const) {
        const id = (parsed as Record<string, unknown>)[key];
        if (typeof id === "string" && id.trim()) voices = { ...voices, [key]: id.trim() };
      }
  }
  const fakeSttUrl = value(source.FAKE_STT_URL) ?? DEFAULT_FAKE_STT_URL;
  if (!/^wss?:\/\//.test(fakeSttUrl))
    throw new Error("FAKE_STT_URL must be a ws:// or wss:// URL.");
  return {
    deepgramApiKey: value(source.DEEPGRAM_API_KEY),
    ttsProvider: provider as TtsProviderName,
    cartesiaApiKey: value(source.CARTESIA_API_KEY),
    elevenLabsApiKey: value(source.ELEVENLABS_API_KEY),
    openAiTts: {
      baseUrl: value(source.OPENAI_TTS_BASE_URL),
      apiKey: value(source.OPENAI_TTS_API_KEY),
      model: value(source.OPENAI_TTS_MODEL) ?? OPENAI_COMPAT_TTS.defaultModel,
      voices,
    },
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
