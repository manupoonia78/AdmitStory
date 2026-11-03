// STT/TTS interfaces, provider adapters, voice pricing and metering (spec §7.5). Server-only code
// lives behind this entry; the browser imports `@admitstory/voice/client` and `/contract` only.
export * from "./contract";
export { CARTESIA, DEEPGRAM, ELEVENLABS, PROVIDER_VOICES } from "./config";
export { parseVoiceEnv, resetVoiceEnv, voiceEnv, type TtsProviderName, type VoiceEnv } from "./env";
export {
  buildKeyterms,
  cleanKeyterm,
  employersFromFacts,
  MBA_TERMS,
  type KeytermSources,
} from "./keyterms";
export {
  sttCostUsd,
  sttLedgerEntry,
  ttsCostUsd,
  ttsLedgerEntry,
  VOICE_RATES,
  type SttProviderName,
  type VoiceLedgerEntry,
} from "./pricing";
export { createDeepgramStt, listenQuery } from "./stt/deepgram";
export { createFakeStt } from "./stt/fake";
export { selectSttProvider } from "./stt/select";
export { createMemoryTtsCache, ttsCacheKey, type TtsCache } from "./tts/cache";
export { createCartesiaTts } from "./tts/cartesia";
export { createElevenLabsTts } from "./tts/elevenlabs";
export {
  abortableSleep,
  createFakeTts,
  estimateWordTimings,
  type FakeTtsOptions,
} from "./tts/fake";
export { selectTtsProvider } from "./tts/select";
export { providerLines, ttsLines, type TtsInput, type TtsStreamOptions } from "./tts/stream";
