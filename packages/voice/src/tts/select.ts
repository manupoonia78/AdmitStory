import type { TTSProvider } from "../contract";
import { voiceEnv, type VoiceEnv } from "../env";
import { createCartesiaTts } from "./cartesia";
import { createDeepgramTts } from "./deepgram";
import { createElevenLabsTts } from "./elevenlabs";
import { createFakeTts } from "./fake";
import { createOpenAiCompatTts } from "./openai-compat";

/**
 * The provider TTS_PROVIDER names when it is configured, otherwise the deterministic fake.
 * Deepgram (the default) uses the dictation key; openai_compat needs its server's base URL.
 */
export function selectTtsProvider(env: VoiceEnv = voiceEnv()): TTSProvider {
  if (env.ttsProvider === "deepgram" && env.deepgramApiKey)
    return createDeepgramTts({ apiKey: env.deepgramApiKey });
  if (env.ttsProvider === "openai_compat" && env.openAiTts.baseUrl)
    return createOpenAiCompatTts({
      baseUrl: env.openAiTts.baseUrl,
      apiKey: env.openAiTts.apiKey,
      model: env.openAiTts.model,
      voices: env.openAiTts.voices,
    });
  if (env.ttsProvider === "cartesia" && env.cartesiaApiKey)
    return createCartesiaTts({ apiKey: env.cartesiaApiKey });
  if (env.ttsProvider === "elevenlabs" && env.elevenLabsApiKey)
    return createElevenLabsTts({ apiKey: env.elevenLabsApiKey });
  return createFakeTts();
}
