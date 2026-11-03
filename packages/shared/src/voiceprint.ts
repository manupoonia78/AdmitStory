// The Voiceprint's identity parameters (spec §6.2) and the seed computed from written answers.
//
// Both live here rather than in packages/ui because the server needs them: the Consolidator seeds
// an applicant's Voiceprint from their Studio answers, and importing the UI package on the server
// would pull in React and the WebGL renderer. packages/ui re-exports these, so every screen still
// imports the Voiceprint contract from one place.

/**
 * Identity parameters, computed once from the first 3 minutes of Studio speech (or from written
 * answers) and stored on the profile as `voiceprint jsonb`. Only these derived numbers are kept:
 * no audio is needed to render a Voiceprint.
 */
export interface VoiceprintIdentity {
  version: 1;
  avgPitchHz: number;
  paceWpm: number;
  pitchRangeSemitones: number;
  /** How regularly the speaker pauses, 0 (even) to 1 (irregular). */
  pauseRhythm: number;
  /** "text": seeded from written answers, sentence-length rhythm standing in for pace and pitch. */
  source: "voice" | "text" | "default";
}

/** What a Voiceprint looks like before there is anything to go on. */
export const DEFAULT_IDENTITY: VoiceprintIdentity = {
  version: 1,
  avgPitchHz: 165,
  paceWpm: 145,
  pitchRangeSemitones: 9,
  pauseRhythm: 0.4,
  source: "default",
};

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const round = (value: number, places: number) => Number(value.toFixed(places));

/** Coefficient of variation (standard deviation over mean); 0 for fewer than two values. */
export function variation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return 0;
  const spread = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(spread) / mean;
}

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
