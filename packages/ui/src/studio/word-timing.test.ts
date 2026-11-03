import { describe, expect, it } from "vitest";
import {
  estimateWordTimings,
  offsetTimings,
  readingEndMs,
  splitWords,
  spokenWordCount,
  type WordTiming,
} from "./word-timing";

const TIMINGS: WordTiming[] = [
  { word: "Where", startMs: 0, endMs: 300 },
  { word: "did", startMs: 300, endMs: 500 },
  { word: "you", startMs: 500, endMs: 700 },
  { word: "grow", startMs: 700, endMs: 1000 },
  { word: "up?", startMs: 1000, endMs: 1300 },
];

describe("splitWords", () => {
  it("splits on any whitespace and keeps punctuation on its word", () => {
    expect(splitWords("  Where did\nyou   grow up? ")).toEqual([
      "Where",
      "did",
      "you",
      "grow",
      "up?",
    ]);
    expect(splitWords("")).toEqual([]);
  });
});

describe("spokenWordCount", () => {
  it("is 0 before the first word and counts each word from its start", () => {
    expect(spokenWordCount(TIMINGS, -50)).toBe(0);
    expect(spokenWordCount(TIMINGS, 0)).toBe(1);
    expect(spokenWordCount(TIMINGS, 299)).toBe(1);
    expect(spokenWordCount(TIMINGS, 300)).toBe(2);
    expect(spokenWordCount(TIMINGS, 1000)).toBe(5);
    expect(spokenWordCount(TIMINGS, 99_999)).toBe(5);
  });

  it("handles no words", () => {
    expect(spokenWordCount([], 100)).toBe(0);
    expect(readingEndMs([])).toBe(0);
  });

  it("agrees with a linear scan at every millisecond", () => {
    for (let ms = -10; ms <= 1400; ms += 7) {
      const linear = TIMINGS.filter((t) => t.startMs <= ms).length;
      expect(spokenWordCount(TIMINGS, ms)).toBe(linear);
    }
  });
});

describe("estimateWordTimings", () => {
  const text =
    "You led the go-live with no manager in place. What was the moment you worried, most?";
  const timings = estimateWordTimings(text, { wpm: 160 });

  it("gives every word a positive, ordered, non-overlapping span", () => {
    expect(timings.map((t) => t.word)).toEqual(splitWords(text));
    for (const [i, t] of timings.entries()) {
      expect(t.endMs).toBeGreaterThan(t.startMs);
      if (i > 0) expect(t.startMs).toBeGreaterThanOrEqual(timings[i - 1]!.endMs);
    }
  });

  it("pauses longer after a sentence than after a clause", () => {
    const gapAfter = (word: string) => {
      const i = timings.findIndex((t) => t.word === word);
      return timings[i + 1]!.startMs - timings[i]!.endMs;
    };
    expect(gapAfter("place.")).toBeGreaterThan(gapAfter("worried,"));
    expect(gapAfter("worried,")).toBeGreaterThan(gapAfter("led"));
  });

  it("speaks at roughly the requested pace", () => {
    // Ordinary prose without punctuation, so only word length sets the pace.
    const words = splitWords(
      "the feed from the lab system was dropping every fourth message and the wards needed results before morning rounds ".repeat(
        6,
      ),
    );
    const slow = estimateWordTimings(words.join(" "), { wpm: 120 });
    const fast = estimateWordTimings(words.join(" "), { wpm: 180 });
    const minutes = (t: WordTiming[]) => readingEndMs(t) / 60_000;
    expect(words.length / minutes(slow)).toBeGreaterThan(100);
    expect(words.length / minutes(slow)).toBeLessThan(145);
    expect(readingEndMs(fast)).toBeLessThan(readingEndMs(slow));
  });

  it("starts at the given offset", () => {
    expect(estimateWordTimings("Hello there", { startMs: 500 })[0]!.startMs).toBe(500);
  });
});

describe("offsetTimings", () => {
  it("moves the first word to the new start and keeps the spacing", () => {
    const moved = offsetTimings(TIMINGS, 2000);
    expect(moved[0]).toEqual({ word: "Where", startMs: 2000, endMs: 2300 });
    expect(moved[4]).toEqual({ word: "up?", startMs: 3000, endMs: 3300 });
  });
});
