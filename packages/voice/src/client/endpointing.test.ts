import { describe, expect, it } from "vitest";
import { createEndpointer, endsSentence } from "./endpointing";

const final = (transcript: string, start: number, end: number, lastWordEnd = end) => ({
  isFinal: true,
  transcript,
  start,
  duration: end - start,
  lastWordEnd: transcript ? lastWordEnd : null,
});
const silence = (start: number, end: number) => final("", start, end);
const interim = (transcript: string, start: number, end: number) => ({
  ...final(transcript, start, end),
  isFinal: false,
});

describe("endsSentence", () => {
  it.each([
    "Done.",
    "Really?",
    "Wow!",
    "And then…",
    "終わり。",
    "本当？",
    "समाप्त।",
    'He said "go."',
    "(yes.)",
  ])("%s ends a sentence", (text) => expect(endsSentence(text)).toBe(true));
  it.each(["and then", "so, um", "the 3.5", "well —", ""])("%s does not", (text) =>
    expect(endsSentence(text)).toBe(false),
  );
});

describe("createEndpointer", () => {
  it("ends after 2.5 s of silence following a sentence end", () => {
    const endpointer = createEndpointer(2_500);
    expect(endpointer.result(final("I led the team.", 0, 3))).toBe(false);
    expect(endpointer.result(silence(3, 4))).toBe(false);
    expect(endpointer.result(silence(4, 5.4))).toBe(false);
    expect(endpointer.result(silence(5.4, 5.6))).toBe(true);
  });

  it("never ends on a pause mid-sentence, however long", () => {
    const endpointer = createEndpointer(2_500);
    expect(endpointer.result(final("I led the team and", 0, 3))).toBe(false);
    for (let t = 3; t < 60; t += 1) expect(endpointer.result(silence(t, t + 1))).toBe(false);
    expect(endpointer.utteranceEnd(3)).toBe(false);
    // The sentence finishes; now the silence counts.
    expect(endpointer.result(final("we shipped.", 60, 62))).toBe(false);
    expect(endpointer.result(silence(62, 64.6))).toBe(true);
  });

  it("measures the silence from the last word, not from when the final arrived", () => {
    const endpointer = createEndpointer(2_500);
    // A final covering trailing silence: the last word ended at 2 s, audio heard to 4.6 s.
    expect(endpointer.result(final("That was it.", 0, 4.6, 2))).toBe(true);
  });

  it("takes Deepgram's UtteranceEnd after a sentence end", () => {
    const endpointer = createEndpointer(2_500);
    endpointer.result(final("That was the year I moved.", 0, 2));
    expect(endpointer.utteranceEnd(2)).toBe(true);
  });

  it("does not end when speech started after the sentence end", () => {
    const endpointer = createEndpointer(2_500);
    endpointer.result(final("That was the year I moved.", 0, 2));
    endpointer.speechStarted(3.5);
    expect(endpointer.utteranceEnd(2)).toBe(false);
    expect(endpointer.result(silence(2, 5.5))).toBe(false);
    // Silence counts again from the new speech: a cough that became no words.
    expect(endpointer.result(silence(5.5, 6.1))).toBe(true);
  });

  it("does not end while interim words are coming in", () => {
    const endpointer = createEndpointer(2_500);
    endpointer.result(final("I moved.", 0, 1));
    expect(endpointer.result(interim("And then", 1, 5))).toBe(false);
    expect(endpointer.result(silence(5, 6))).toBe(false);
    expect(endpointer.result(final("And then I stayed", 1, 6, 5))).toBe(false);
    expect(endpointer.result(silence(6, 9))).toBe(false);
  });

  it("honours a configured gap", () => {
    const endpointer = createEndpointer(1_000);
    endpointer.result(final("Short.", 0, 1));
    expect(endpointer.result(silence(1, 2.05))).toBe(true);
  });
});
