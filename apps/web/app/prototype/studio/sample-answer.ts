// A scripted answer played as if spoken (prototype only): word timings stand in for speech, and
// the transcript is rebuilt the way streaming speech-to-text delivers it (spec §7.5). Interim
// words arrive a phrase at a time shortly after they are spoken; each segment turns final a
// moment after its last word. Pure, so the timeline is unit-tested.

import {
  estimateWordTimings,
  offsetTimings,
  readingEndMs,
  spansFromTimings,
  type StoryCardData,
  type TranscriptSegment,
  type VoicedSpan,
  type WordTiming,
} from "@admitstory/ui";

export interface SampleSegment {
  id: string;
  text: string;
  /** A story found in this segment; captured when the segment turns final. */
  story?: StoryCardData;
}

export interface PlannedSegment extends SampleSegment {
  words: WordTiming[];
  /** When each interim phrase arrives: [word count shown, at ms]. */
  phrases: [count: number, atMs: number][];
  finalMs: number;
}

export interface SamplePlan {
  segments: PlannedSegment[];
  /** Every voiced word, for the synthetic voice signal. */
  spans: VoicedSpan[];
  /** When the last segment is final: the answer is over. */
  endMs: number;
}

export interface PlanOptions {
  /** Silence before the first word. */
  leadInMs?: number;
  wpm?: number;
  /** Breath between segments. */
  gapMs?: number;
  /** Interim results trail speech by this much. */
  latencyMs?: number;
  /** A segment turns final this long after its last word. */
  finalDelayMs?: number;
  /** Most words per interim phrase. */
  phraseWords?: number;
}

const PHRASE_END = /[,.;:?!—]$/;

export function planSample(
  segments: readonly SampleSegment[],
  {
    leadInMs = 500,
    wpm = 165,
    gapMs = 420,
    latencyMs = 140,
    finalDelayMs = 450,
    phraseWords = 3,
  }: PlanOptions = {},
): SamplePlan {
  const planned: PlannedSegment[] = [];
  let cursor = leadInMs;
  for (const segment of segments) {
    const words = offsetTimings(estimateWordTimings(segment.text, { wpm }), cursor);
    const phrases: [number, number][] = [];
    let inPhrase = 0;
    words.forEach((word, index) => {
      inPhrase += 1;
      const last = index === words.length - 1;
      if (last || inPhrase >= phraseWords || PHRASE_END.test(word.word)) {
        phrases.push([index + 1, word.endMs + latencyMs]);
        inPhrase = 0;
      }
    });
    const spoken = readingEndMs(words);
    planned.push({ ...segment, words, phrases, finalMs: spoken + finalDelayMs });
    cursor = spoken + gapMs;
  }
  return {
    segments: planned,
    spans: planned.flatMap((segment) => spansFromTimings(segment.words)),
    endMs: planned.at(-1)?.finalMs ?? 0,
  };
}

/** The transcript as it stands at `ms`: arrived phrases as interim text, finished segments final. */
export function transcriptAt(plan: SamplePlan, ms: number): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];
  for (const segment of plan.segments) {
    if (ms >= segment.finalMs) {
      result.push({ id: segment.id, text: segment.text, final: true });
      continue;
    }
    let count = 0;
    for (const [shown, atMs] of segment.phrases) if (atMs <= ms) count = shown;
    if (count === 0) break;
    const text = segment.words
      .slice(0, count)
      .map((word) => word.word)
      .join(" ");
    result.push({ id: segment.id, text, final: false });
    break;
  }
  return result;
}

/** True when two transcripts would render the same, so React only updates on real changes. */
export function sameTranscript(
  a: readonly TranscriptSegment[],
  b: readonly TranscriptSegment[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (segment, i) =>
        segment.id === b[i]?.id && segment.text === b[i]?.text && segment.final === b[i]?.final,
    )
  );
}

/** Segments whose story is found by `ms`: each is captured once its segment turns final. */
export function storiesDueAt(plan: SamplePlan, ms: number): PlannedSegment[] {
  return plan.segments.filter((segment) => segment.story && ms >= segment.finalMs);
}
