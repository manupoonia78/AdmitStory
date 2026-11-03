import "server-only";

import {
  SPEECH_LANGUAGES,
  TTS_SPEEDS,
  TTS_VOICES,
  type SpeechLanguage,
  type TtsVoice,
} from "@admitstory/voice";
import { z } from "zod";

// Zod for the voice contract's values (packages/voice/src/contract.ts). Server-side only: the
// contract is plain constants so that the browser never bundles Zod.

const ids = <T extends string>(list: readonly { id: T }[]) =>
  list.map((entry) => entry.id) as [T, ...T[]];

export const SpeechLanguageSchema = z.enum(ids<SpeechLanguage>(SPEECH_LANGUAGES));
export const TtsVoiceSchema = z.enum(ids<TtsVoice>(TTS_VOICES));
export const TtsSpeedSchema = z.literal(TTS_SPEEDS);

/** PATCH /api/profile/voice. */
export const VoiceSettingsPatchBody = z
  .strictObject({
    readAloud: z.boolean(),
    speechLanguage: SpeechLanguageSchema,
    ttsVoice: TtsVoiceSchema,
    ttsSpeed: TtsSpeedSchema,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Change at least one setting.");

/** Spec §6.2: a few derived numbers, computed in the browser from the first minutes of speech. */
export const SpokenVoiceprintBody = z.strictObject({
  version: z.literal(1),
  avgPitchHz: z.number().min(50).max(500),
  paceWpm: z.number().min(0).max(400),
  pitchRangeSemitones: z.number().min(0).max(48),
  pauseRhythm: z.number().min(0).max(1),
  source: z.literal("voice"),
});

/** BCP 47, as Deepgram reports a detected language. */
export const LanguageTag = z
  .string()
  .trim()
  .max(35)
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "BCP 47 language tag");

/** One answer's dictation: past half an hour, the number is not an answer's but a stuck client's. */
export const MAX_VOICE_SECONDS_PER_ANSWER = 30 * 60;

/** POST /api/tts: questions are one or two sentences (§8.5.1); this is a cost cap, not a style rule. */
export const MAX_TTS_CHARS = 600;
