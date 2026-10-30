// Identity parameters (spec §6.2): computed once from up to three minutes of speech, or seeded
// from written answers for someone who never speaks. Only the four derived numbers leave this
// file; the per-frame samples it holds while listening are discarded with it.

import type { AnalysisFrame } from "./audio-features";
import { DEFAULT_IDENTITY } from "./params";
import type { VoiceprintIdentity } from "./types";

/** Seconds of speech in a full sample (spec §6.2: "the first 3 minutes"). */
export const IDENTITY_SAMPLE_SECONDS = 180;
/** Below this much speech the numbers are too noisy to mean anything. */
export const IDENTITY_MIN_SECONDS = 10;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const clamp01 = (value: number) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const round = (value: number, places: number) => Number(value.toFixed(places));

/** Nearest-rank quantile of an already sorted list (q in 0..1). */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = clamp(Math.ceil(q * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[index] ?? 0;
}

/** Coefficient of variation (standard deviation over mean); 0 for fewer than two values. */
export function variation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/* From speech ------------------------------------------------------------------------------ */

// Speech segmentation on the normalised amplitude, with hysteresis so a word's tail doesn't
// flicker between speech and silence.
const SPEECH_ON = 0.12;
const SPEECH_OFF = 0.06;
// Silences shorter than this are stop consonants, not pauses; longer than LONG_BREAK_S are the
// speaker stepping away, not rhythm.
const MIN_PAUSE_S = 0.25;
const LONG_BREAK_S = 4;
// Syllable nuclei: peaks in a fast loudness envelope at least 3 dB above the valley before them,
// on voiced audio, at most ~11 a second.
const NUCLEUS_PROMINENCE_DB = 3;
const NUCLEUS_MIN_GAP_S = 0.09;
const NUCLEUS_MIN_SNR_DB = 10;
const ENVELOPE_TAU_S = 0.015;
/** Average syllables per English word, for turning a syllable rate into words per minute. */
export const SYLLABLES_PER_WORD = 1.5;
const PITCH_SAMPLE_GAP_S = 0.02;
const MIN_PITCH_SAMPLES = 20;

export interface AccumulatorSnapshot {
  /** Seconds of speech counted so far (pauses don't count). */
  speechSeconds: number;
  /** speechSeconds over IDENTITY_SAMPLE_SECONDS, 0..1. */
  progress: number;
  /** True once a full sample has been heard. */
  done: boolean;
  /** True once there is enough speech for identity() to return a result. */
  usable: boolean;
}

export interface IdentityAccumulator {
  add(frame: AnalysisFrame): void;
  snapshot(): AccumulatorSnapshot;
  /** The identity so far, or null when there isn't enough speech yet. */
  identity(): VoiceprintIdentity | null;
  reset(): void;
}

/**
 * Listens to analysis frames and derives the identity:
 *  - average pitch: the median of voiced frames, robust to the odd octave slip;
 *  - pitch range: p10 to p90 of voiced pitch, in semitones;
 *  - pace: an approximation. There is no speech-to-text until Phase 2, so words per minute are
 *    estimated from the rate of syllable nuclei (peaks in the loudness envelope on voiced audio)
 *    over talking time, divided by SYLLABLES_PER_WORD. Expect ±20% against a transcript count;
 *    it is stable for one speaker, which is what a Voiceprint needs;
 *  - pause rhythm: how irregular the pauses are, from the variation in their lengths and in the
 *    gaps between them, 0 (even) to 1 (irregular).
 */
export function createIdentityAccumulator(): IdentityAccumulator {
  let speechSeconds = 0;
  let pausedSeconds = 0;
  let speaking = false;
  let silenceRun = 0;
  let heardSpeech = false;
  let elapsed = 0;
  const pitches: number[] = [];
  let lastPitchSample = -Infinity;
  const pauses: number[] = [];
  const pauseStarts: number[] = [];

  let envelope = 0;
  let rising = true;
  let peak = 0;
  let peakVoiced = false;
  let valley = 0;
  let lastNucleus = -Infinity;
  let syllables = 0;

  const reset = () => {
    speechSeconds = 0;
    pausedSeconds = 0;
    speaking = false;
    silenceRun = 0;
    heardSpeech = false;
    elapsed = 0;
    pitches.length = 0;
    lastPitchSample = -Infinity;
    pauses.length = 0;
    pauseStarts.length = 0;
    envelope = 0;
    rising = true;
    peak = 0;
    peakVoiced = false;
    valley = 0;
    lastNucleus = -Infinity;
    syllables = 0;
  };

  const trackNuclei = (frame: AnalysisFrame) => {
    envelope =
      frame.dt > 0
        ? envelope + (frame.snrDb - envelope) * (1 - Math.exp(-frame.dt / ENVELOPE_TAU_S))
        : frame.snrDb;
    const voiced = frame.pitchHz !== null;
    if (rising) {
      if (envelope > peak) peak = envelope;
      peakVoiced ||= voiced;
      if (envelope < peak - NUCLEUS_PROMINENCE_DB) {
        if (
          peak - valley >= NUCLEUS_PROMINENCE_DB &&
          peak >= NUCLEUS_MIN_SNR_DB &&
          peakVoiced &&
          frame.time - lastNucleus >= NUCLEUS_MIN_GAP_S
        ) {
          syllables += 1;
          lastNucleus = frame.time;
        }
        rising = false;
        valley = envelope;
      }
    } else {
      if (envelope < valley) valley = envelope;
      if (envelope > valley + NUCLEUS_PROMINENCE_DB) {
        rising = true;
        peak = envelope;
        peakVoiced = voiced;
      }
    }
  };

  const snapshot = (): AccumulatorSnapshot => ({
    speechSeconds,
    progress: clamp01(speechSeconds / IDENTITY_SAMPLE_SECONDS),
    done: speechSeconds >= IDENTITY_SAMPLE_SECONDS,
    usable: speechSeconds >= IDENTITY_MIN_SECONDS && pitches.length >= MIN_PITCH_SAMPLES,
  });

  return {
    reset,
    snapshot,
    add(frame) {
      // A full sample is enough; later speech doesn't move the identity.
      if (speechSeconds >= IDENTITY_SAMPLE_SECONDS) return;
      elapsed += frame.dt;
      trackNuclei(frame);

      const wasSpeaking = speaking;
      speaking = speaking ? frame.amplitude > SPEECH_OFF : frame.amplitude > SPEECH_ON;
      if (speaking) {
        if (
          !wasSpeaking &&
          heardSpeech &&
          silenceRun >= MIN_PAUSE_S &&
          silenceRun <= LONG_BREAK_S
        ) {
          pauses.push(silenceRun);
          pauseStarts.push(elapsed - silenceRun);
          pausedSeconds += silenceRun;
        }
        speechSeconds += frame.dt;
        heardSpeech = true;
        silenceRun = 0;
      } else {
        silenceRun += frame.dt;
      }

      if (
        speaking &&
        frame.pitchHz !== null &&
        frame.time - lastPitchSample >= PITCH_SAMPLE_GAP_S
      ) {
        pitches.push(frame.pitchHz);
        lastPitchSample = frame.time;
      }
    },
    identity() {
      if (!snapshot().usable) return null;
      const sorted = [...pitches].sort((a, b) => a - b);
      const median = quantile(sorted, 0.5);
      const low = quantile(sorted, 0.1);
      const high = quantile(sorted, 0.9);
      const talkingMinutes = (speechSeconds + pausedSeconds) / 60;
      const wpm = talkingMinutes > 0 ? syllables / talkingMinutes / SYLLABLES_PER_WORD : 0;
      const gaps = pauseStarts.slice(1).map((start, i) => start - (pauseStarts[i] ?? start));
      const rhythm =
        pauses.length >= 3
          ? clamp01((variation(pauses) + variation(gaps)) / 2 / 0.8)
          : DEFAULT_IDENTITY.pauseRhythm;
      return {
        version: 1,
        avgPitchHz: round(median, 1),
        paceWpm: Math.round(clamp(wpm, 60, 260)),
        pitchRangeSemitones: round(low > 0 ? 12 * Math.log2(high / low) : 0, 1),
        pauseRhythm: round(rhythm, 2),
        source: "voice",
      };
    },
  };
}

/* From writing ----------------------------------------------------------------------------- */

const SENTENCE_BREAK = /(?<=[.!?…])\s+|\n+/u;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const CLAUSE_MARK = /[,;:—–()]/g;

/**
 * Seeds an identity from written answers, for applicants who never speak (spec §6.2). Sentence
 * rhythm stands in for the voice: longer sentences for a faster pace, varied sentence lengths
 * for a wider pitch range, a larger share of short sentences for a higher pitch, and irregular
 * clause breaks for an irregular pause rhythm. Deterministic, and it never stores the text.
 */
export function identityFromText(answers: readonly string[]): VoiceprintIdentity {
  const sentences = answers
    .flatMap((answer) => answer.split(SENTENCE_BREAK))
    .map((sentence) => sentence.trim())
    .filter((sentence) => (sentence.match(WORD)?.length ?? 0) > 0);
  if (sentences.length === 0) return DEFAULT_IDENTITY;

  const lengths = sentences.map((sentence) => sentence.match(WORD)?.length ?? 0);
  const words = sentences.flatMap((sentence) => sentence.match(WORD) ?? []);
  const meanLength = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  const meanWord = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const shortShare = lengths.filter((n) => n < 10).length / lengths.length;
  const clauses = sentences.map((sentence) => 1 + (sentence.match(CLAUSE_MARK)?.length ?? 0));

  const pace = 100 + clamp01((meanLength - 8) / 22) * 100;
  const range = 4 + clamp01(variation(lengths) / 0.8) * 14;
  // 95 Hz to about 250 Hz, on a log scale; word length nudges it so similar rhythms still differ.
  const pitch = 95 * 2 ** (clamp01(shortShare * 0.8 + clamp01((5.5 - meanWord) / 2.5) * 0.2) * 1.4);
  const rhythm = clamp01(variation(clauses) / 0.9);

  return {
    version: 1,
    avgPitchHz: round(pitch, 1),
    paceWpm: Math.round(pace),
    pitchRangeSemitones: round(range, 1),
    pauseRhythm: round(rhythm, 2),
    source: "text",
  };
}
