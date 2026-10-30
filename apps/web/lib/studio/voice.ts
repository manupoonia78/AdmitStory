import "server-only";

import type { VoiceStats } from "@admitstory/db";

// Sentence statistics for the voice profile (spec §5.3d, §8.5.3). Computed in code and passed to
// the Consolidator, which reads them rather than counting: a model is bad at arithmetic and this
// has to be exact, because the §8.8 rhythm linter later checks drafts against the same measure.

const SENTENCE_BREAK = /(?<=[.!?…])["'”’)\]]*\s+/u;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

function sentenceLengths(texts: readonly string[]): number[] {
  return texts
    .flatMap((text) => text.split(SENTENCE_BREAK))
    .map((sentence) => sentence.match(WORD)?.length ?? 0)
    .filter((length) => length > 0);
}

/** Coefficient of variation: standard deviation over mean. Zero for fewer than two sentences. */
function variation(values: readonly number[], mean: number, stdDev: number): number {
  return values.length < 2 || mean <= 0 ? 0 : stdDev / mean;
}

const round = (value: number, places = 2) => Number(value.toFixed(places));

export function voiceStatsFrom(texts: readonly string[]): VoiceStats {
  const lengths = sentenceLengths(texts);
  if (lengths.length === 0)
    return {
      sentenceLengthMean: 0,
      sentenceLengthStdDev: 0,
      sentenceLengthVariation: 0,
      wordCount: 0,
      sentenceCount: 0,
    };

  const total = lengths.reduce((sum, length) => sum + length, 0);
  const mean = total / lengths.length;
  const stdDev = Math.sqrt(
    lengths.reduce((sum, length) => sum + (length - mean) ** 2, 0) / lengths.length,
  );

  return {
    sentenceLengthMean: round(mean),
    sentenceLengthStdDev: round(stdDev),
    sentenceLengthVariation: round(variation(lengths, mean, stdDev)),
    wordCount: total,
    sentenceCount: lengths.length,
    longestSentence: Math.max(...lengths),
    shortestSentence: Math.min(...lengths),
  };
}

/**
 * Sentences worth showing the Consolidator as voice samples: the longest few from each answer,
 * which carry more of a person's cadence than a one-word reply. Capped, because they go into a
 * prompt.
 */
export function voiceSamplesFrom(texts: readonly string[], limit = 30): string[] {
  return texts
    .flatMap((text) => text.split(SENTENCE_BREAK))
    .map((sentence) => sentence.trim())
    .filter((sentence) => (sentence.match(WORD)?.length ?? 0) >= 4)
    .slice(0, limit);
}
