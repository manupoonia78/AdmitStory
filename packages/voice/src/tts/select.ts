import type { TTSProvider } from "../contract";
import { voiceEnv, type VoiceEnv } from "../env";
import { createCartesiaTts } from "./cartesia";
import { createElevenLabsTts } from "./elevenlabs";
import { createFakeTts } from "./fake";

/** The provider TTS_PROVIDER names when its key is set, otherwise the deterministic fake. */
export function selectTtsProvider(env: VoiceEnv = voiceEnv()): TTSProvider {
  if (env.ttsProvider === "cartesia" && env.cartesiaApiKey)
    return createCartesiaTts({ apiKey: env.cartesiaApiKey });
  if (env.ttsProvider === "elevenlabs" && env.elevenLabsApiKey)
    return createElevenLabsTts({ apiKey: env.elevenLabsApiKey });
  return createFakeTts();
}
