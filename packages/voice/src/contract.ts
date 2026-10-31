// The Phase 2 voice contract (spec §7.5, §11). Shared by the server adapters, the API routes and
// the browser client, so each side can be built against it alone. Plain types and constants only:
// this file is imported by client code and must never pull Zod or a provider SDK into a bundle.

/** Dictation audio as §7.5 specifies it: 16 kHz mono, 16-bit little-endian PCM. */
export const DICTATION_SAMPLE_RATE = 16_000;

/** §5.2: an answer ends after this much silence following a sentence end, or on "Done". */
export const DEFAULT_UTTERANCE_END_MS = 2_500;

/** §7.5: the STT token lives 60 s and is good for one connection. */
export const STT_TOKEN_TTL_SECONDS = 60;

/** §12.4: a free user gets 120 voice minutes; after that the Studio continues in text. */
export const FREE_VOICE_SECONDS = 120 * 60;

/** §7.5: read-aloud audio is cached by hash of text + voice for 24 h. */
export const TTS_CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Speech languages offered in Settings. `multi` is Deepgram's code-switching multilingual mode. */
export const SPEECH_LANGUAGES = [
  { id: "en", label: "English" },
  { id: "multi", label: "English and another language" },
  { id: "hi", label: "Hindi" },
  { id: "es", label: "Spanish" },
  { id: "pt", label: "Portuguese" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "ja", label: "Japanese" },
  { id: "vi", label: "Vietnamese" },
] as const;
export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number]["id"];

/** Interviewer voices offered in Settings. Ids are ours; adapters map them to provider voice ids. */
export const TTS_VOICES = [
  { id: "warm", label: "Warm" },
  { id: "clear", label: "Clear" },
  { id: "low", label: "Low" },
] as const;
export type TtsVoice = (typeof TTS_VOICES)[number]["id"];

export const TTS_SPEEDS = [0.85, 1, 1.15] as const;
export type TtsSpeed = (typeof TTS_SPEEDS)[number];

/** `profiles` columns the voice settings live in (read_aloud is §10; the rest are Phase 2 additions). */
export interface VoiceSettings {
  readAloud: boolean;
  speechLanguage: SpeechLanguage;
  ttsVoice: TtsVoice;
  ttsSpeed: TtsSpeed;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  readAloud: true,
  speechLanguage: "en",
  ttsVoice: "warm",
  ttsSpeed: 1,
};

// ── POST /api/stt/token ─────────────────────────────────────────────────────────────────────────

/** Everything the browser needs to open one Deepgram streaming connection. */
export interface SttTokenResponse {
  /** Full wss:// URL including every query parameter (model, encoding, keyterms, language…). */
  url: string;
  /** Sent as the WebSocket subprotocol pair `["bearer", token]` (or `["token", token]` for a fake). */
  protocols: string[];
  expiresAt: string;
  /** Voice seconds left on the free allowance, so the client can warn before it runs out. */
  remainingSeconds: number;
  /** `fake` in development without DEEPGRAM_API_KEY: the URL points at the local fake server. */
  provider: "deepgram" | "fake";
}

/** Reasons /api/stt/token refuses, so the Studio can show the right state rather than an error. */
export type SttRefusal = "email_unverified" | "voice_minutes_used" | "stt_unavailable";

// ── Deepgram streaming messages the client consumes (the subset we rely on) ───────────────────

export interface SttWord {
  word: string;
  /** Punctuated form when smart_format/punctuate is on. */
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
}

export type SttServerMessage =
  | {
      type: "Results";
      is_final: boolean;
      speech_final: boolean;
      /** Seconds from the start of the stream. */
      start: number;
      duration: number;
      channel: { alternatives: { transcript: string; words: SttWord[] }[] };
      /** Present with language=multi or detect_language. */
      languages?: string[];
    }
  | { type: "UtteranceEnd"; last_word_end: number }
  | { type: "SpeechStarted"; timestamp: number }
  | { type: "Metadata"; request_id: string; duration: number };

// ── POST /api/tts ───────────────────────────────────────────────────────────────────────────────

export interface TtsRequest {
  text: string;
  /** Omitted: the applicant's saved voice and speed. */
  voice?: TtsVoice;
  speed?: TtsSpeed;
}

/** TTS output audio: raw PCM so Web Audio can schedule it on every browser, iOS Safari included. */
export const TTS_SAMPLE_RATE = 24_000;

/**
 * /api/tts streams NDJSON, one object per line, in this order: one `start`, then interleaved
 * `audio` and `words` chunks, then one `end`. Audio is base64 16-bit little-endian mono PCM at
 * TTS_SAMPLE_RATE. Word times are milliseconds from the start of playback (WordTiming in
 * packages/ui). A cached response replays the same lines.
 */
export type TtsStreamLine =
  | { type: "start"; sampleRate: number; cached: boolean; voice: TtsVoice }
  | { type: "audio"; pcm: string }
  | { type: "words"; words: { word: string; startMs: number; endMs: number }[] }
  | { type: "end"; chars: number }
  | { type: "error"; message: string };

// ── Studio turns: what a dictated answer adds to POST /api/studio/turns ───────────────────────

export interface VoiceTurnFields {
  inputMode: "voice" | "text";
  /** Seconds of microphone audio streamed for this answer (metered against FREE_VOICE_SECONDS). */
  voiceSeconds?: number;
  /** BCP-47 language Deepgram reported, when not English. */
  language?: string;
}

// ── Provider interfaces (server side; implementations live in packages/voice/src/{stt,tts}) ───

export interface SttMintInput {
  userId: string;
  language: SpeechLanguage;
  /** School names, employer, people's names, MBA terms — see keyterms.ts. */
  keyterms: readonly string[];
  utteranceEndMs: number;
}

export interface STTProvider {
  readonly name: "deepgram" | "fake";
  mint(input: SttMintInput): Promise<Omit<SttTokenResponse, "remainingSeconds">>;
}

export interface TtsChunk {
  /** 16-bit LE mono PCM at TTS_SAMPLE_RATE. */
  pcm?: Uint8Array;
  words?: { word: string; startMs: number; endMs: number }[];
}

export interface TTSProvider {
  readonly name: "cartesia" | "elevenlabs" | "fake";
  synthesize(
    input: { text: string; voice: TtsVoice; speed: TtsSpeed },
    signal?: AbortSignal,
  ): AsyncIterable<TtsChunk>;
}
