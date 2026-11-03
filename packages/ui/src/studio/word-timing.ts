// Word timestamps for speech the product reads aloud (spec §6.4: Story Studio questions brighten
// word by word "in sync with the TTS word timestamps", §7.5). In the product the timestamps come
// from TTS; estimateWordTimings() stands in where there are none (prototypes, previews, a TTS
// voice that returns no marks), so captions still move at a believable speaking pace.

export interface WordTiming {
  word: string;
  /** Offset from the start of playback. */
  startMs: number;
  endMs: number;
}

/** The words of a sentence as spoken units; punctuation stays attached to its word. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * How many words have started by `ms`: 0 before the first word, timings.length once the last has
 * started. Timings are in speaking order, so a binary search finds the boundary.
 */
export function spokenWordCount(timings: readonly WordTiming[], ms: number): number {
  let low = 0;
  let high = timings.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((timings[mid]?.startMs ?? Infinity) <= ms) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** When the last word finishes: reading is over. 0 for no words. */
export function readingEndMs(timings: readonly WordTiming[]): number {
  return timings.at(-1)?.endMs ?? 0;
}

export interface EstimateOptions {
  /** Speaking pace. TTS voices sit around 150–170 words per minute. */
  wpm?: number;
  /** Offset of the first word. */
  startMs?: number;
  /** Silence after a comma, colon, semicolon or dash. */
  clausePauseMs?: number;
  /** Silence after a full stop, question mark or exclamation mark. */
  sentencePauseMs?: number;
}

const SENTENCE_END = /[.?!…]["'”’)]*$/;
const CLAUSE_END = /[,;:—–]["'”’)]*$/;

/**
 * Believable word timestamps for text with none. Each word lasts in proportion to its letters
 * (clamped, so "a" and "responsibilities" both sound natural), the average word keeps the given
 * pace, and punctuation adds the pauses a speaker would take.
 */
export function estimateWordTimings(text: string, options: EstimateOptions = {}): WordTiming[] {
  const { wpm = 160, startMs = 0, clausePauseMs = 160, sentencePauseMs = 340 } = options;
  const beat = 60_000 / wpm;
  const timings: WordTiming[] = [];
  let cursor = startMs;
  for (const word of splitWords(text)) {
    const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
    const duration = Math.round(beat * Math.min(1.8, Math.max(0.55, letters / 5)));
    timings.push({ word, startMs: cursor, endMs: cursor + duration });
    cursor += duration;
    if (SENTENCE_END.test(word)) cursor += sentencePauseMs;
    else if (CLAUSE_END.test(word)) cursor += clausePauseMs;
  }
  return timings;
}

/** The same timings, shifted so the first word starts at `startMs`. */
export function offsetTimings(timings: readonly WordTiming[], startMs: number): WordTiming[] {
  const shift = startMs - (timings[0]?.startMs ?? 0);
  return timings.map((t) => ({ word: t.word, startMs: t.startMs + shift, endMs: t.endMs + shift }));
}
