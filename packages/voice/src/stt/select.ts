import type { STTProvider } from "../contract";
import { voiceEnv, type VoiceEnv } from "../env";
import { createDeepgramStt } from "./deepgram";
import { createFakeStt } from "./fake";

/** Deepgram when its key is set, otherwise the local fake. */
export function selectSttProvider(env: VoiceEnv = voiceEnv()): STTProvider {
  return env.deepgramApiKey
    ? createDeepgramStt({ apiKey: env.deepgramApiKey })
    : createFakeStt({ url: env.fakeSttUrl });
}
