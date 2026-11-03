// When a spoken answer is over (spec §5.2, §7.5): "Done", or `utteranceEndMs` of silence after a
// sentence end. A pause mid-sentence never ends the answer — long thoughtful monologues are the
// point. Pure and deterministic: its clock is the audio timeline Deepgram reports (seconds since
// the start of the answer), not the wall clock, so network lag or a reconnect cannot cut anyone
// off, and tests need no timers.

import { DEFAULT_UTTERANCE_END_MS } from "../contract";

/** . ? ! … and their CJK, full-width and Devanagari forms, before any closing quotes/brackets. */
const SENTENCE_END = /[.?!…。？！．।॥]["'”’)\]»」』]*$/u;

export function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text.trimEnd());
}

/** A Results message with times already on the answer's timeline. */
export interface EndpointResult {
  isFinal: boolean;
  transcript: string;
  /** The audio this message covers: [start, start + duration] seconds. */
  start: number;
  duration: number;
  /** End of the last word, when there are words. */
  lastWordEnd: number | null;
}

export interface Endpointer {
  /** Returns true when the answer should end now. */
  result(result: EndpointResult): boolean;
  /**
   * Deepgram's UtteranceEnd: no words for `utterance_end_ms` after `lastWordEnd` (the token route
   * configures the same gap). Returns true when the answer should end now.
   */
  utteranceEnd(lastWordEnd: number): boolean;
  /** Deepgram's VAD heard speech start at `timestamp`. */
  speechStarted(timestamp: number): void;
}

export function createEndpointer(utteranceEndMs = DEFAULT_UTTERANCE_END_MS): Endpointer {
  const gap = utteranceEndMs / 1000;
  // Does the transcript so far end a sentence?
  let sentenceEnded = false;
  // The latest sign of speech (a word, or VAD) and how far the server has listened.
  let lastSpeech = 0;
  let heard = 0;
  // An utterance end is only trusted if no speech came after the word it refers to.
  const tolerance = 0.05;

  const silentLongEnough = () => sentenceEnded && heard - lastSpeech >= gap;

  return {
    result({ isFinal, transcript, start, duration, lastWordEnd }) {
      heard = Math.max(heard, start + duration);
      const spoken = transcript.trim().length > 0;
      if (spoken && lastWordEnd !== null) lastSpeech = Math.max(lastSpeech, lastWordEnd);
      if (isFinal && spoken) sentenceEnded = endsSentence(transcript);
      // Interim words after a sentence end mean the speaker carried on; the final will tell.
      if (!isFinal && spoken) return false;
      return silentLongEnough();
    },
    utteranceEnd(lastWordEnd) {
      if (!sentenceEnded || lastSpeech > lastWordEnd + tolerance) return false;
      heard = Math.max(heard, lastWordEnd + gap);
      return true;
    },
    speechStarted(timestamp) {
      lastSpeech = Math.max(lastSpeech, timestamp);
    },
  };
}
