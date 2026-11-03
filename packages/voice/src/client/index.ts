// The browser side of voice (spec §7.5): dictation to Deepgram and questions read aloud. Import
// it lazily (next/dynamic or import()) so none of it is in a route's first load (§6.11). Plain
// TypeScript and React only: no Zod, no server modules.

export { createPcmEncoder, type PcmEncoder } from "./resample";
export { CAPTURE_PROCESSOR, FRAME_SAMPLES, startPcmCapture, type PcmCapture } from "./capture";
export { createEndpointer, endsSentence, type Endpointer } from "./endpointing";
export {
  createDictationSession,
  type DictationOptions,
  type DictationResult,
  type DictationSession,
  type DictationSnapshot,
  type DictationState,
  type NetworkStatus,
  type SttTokenOutcome,
} from "./dictation";
export { fetchSttToken, readSttTokenBody } from "./token";
export { createNdjsonParser, toTtsLine } from "./ndjson";
export {
  createReadAloudPlayer,
  type ReadAloudClock,
  type ReadAloudOptions,
  type ReadAloudOutcome,
  type ReadAloudPlayer,
  type ReadAloudSnapshot,
  type ReadAloudStatus,
  type SpokenWordTiming,
} from "./tts-player";
export {
  ANSWER_SUBMITTED_MARK,
  ANSWER_TO_QUESTION_MEASURE,
  TTS_FIRST_AUDIO_MEASURE,
  markAnswerSubmitted,
} from "./marks";
export {
  useDictation,
  useReadAloud,
  type Dictation,
  type ReadAloud,
  type SharedMicrophone,
  type UseDictationOptions,
} from "./hooks";
