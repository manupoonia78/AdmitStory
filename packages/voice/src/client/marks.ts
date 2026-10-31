// Performance marks for the Phase 2 latency AC: question audio starts ≤ 2.0 s (p50) after the
// answer is submitted ("Done" or the auto end). Visible in the browser's Performance panel and to
// any PerformanceObserver; nothing is sent anywhere.

export const ANSWER_SUBMITTED_MARK = "studio:answer-submitted";
export const TTS_REQUEST_MARK = "tts:request";
export const TTS_FIRST_AUDIO_MARK = "tts:first-audio";
/** Request → first scheduled audio. */
export const TTS_FIRST_AUDIO_MEASURE = "tts:time-to-first-audio";
/** Answer submitted → question audio: the AC number. */
export const ANSWER_TO_QUESTION_MEASURE = "studio:answer-to-question-audio";

const performanceApi = (): Performance | null =>
  typeof performance !== "undefined" && typeof performance.mark === "function" ? performance : null;

function mark(name: string): void {
  try {
    performanceApi()?.mark(name);
  } catch {
    // Marks are diagnostics; never let them break the Studio.
  }
}

function measure(name: string, start: string, end: string): number | null {
  const api = performanceApi();
  if (!api || api.getEntriesByName(start, "mark").length === 0) return null;
  try {
    return api.measure(name, start, end).duration;
  } catch {
    return null;
  }
}

/** Call when an answer is submitted. Dictation calls it itself; typed answers should too. */
export function markAnswerSubmitted(): void {
  mark(ANSWER_SUBMITTED_MARK);
}

export function markTtsRequest(): void {
  mark(TTS_REQUEST_MARK);
}

/**
 * Marks the first audio of a read-aloud and returns the two measures (ms), each null when its
 * start mark is missing. The answer mark is consumed so a later question is not measured twice.
 */
export function markTtsFirstAudio(): {
  timeToFirstAudio: number | null;
  answerToAudio: number | null;
} {
  mark(TTS_FIRST_AUDIO_MARK);
  const timeToFirstAudio = measure(TTS_FIRST_AUDIO_MEASURE, TTS_REQUEST_MARK, TTS_FIRST_AUDIO_MARK);
  const answerToAudio = measure(
    ANSWER_TO_QUESTION_MEASURE,
    ANSWER_SUBMITTED_MARK,
    TTS_FIRST_AUDIO_MARK,
  );
  const api = performanceApi();
  api?.clearMarks(ANSWER_SUBMITTED_MARK);
  api?.clearMarks(TTS_REQUEST_MARK);
  api?.clearMarks(TTS_FIRST_AUDIO_MARK);
  return { timeToFirstAudio, answerToAudio };
}
