import { describe, expect, it } from "vitest";
import { SAMPLE_ANSWER } from "./script";
import { planSample, sameTranscript, storiesDueAt, transcriptAt } from "./sample-answer";

const plan = planSample(SAMPLE_ANSWER);

describe("planSample", () => {
  it("speaks the segments in order with a breath between them", () => {
    for (let i = 1; i < plan.segments.length; i += 1) {
      const previous = plan.segments[i - 1]!;
      const current = plan.segments[i]!;
      expect(current.words[0]!.startMs).toBeGreaterThan(previous.words.at(-1)!.endMs);
    }
  });

  it("delivers each segment as interim phrases of at most three words", () => {
    for (const segment of plan.segments) {
      let shown = 0;
      for (const [count, atMs] of segment.phrases) {
        expect(count - shown).toBeGreaterThan(0);
        expect(count - shown).toBeLessThanOrEqual(3);
        expect(atMs).toBeLessThan(segment.finalMs);
        shown = count;
      }
      expect(shown).toBe(segment.words.length);
    }
  });

  it("lasts long enough to watch and short enough to record", () => {
    expect(plan.endMs).toBeGreaterThan(12_000);
    expect(plan.endMs).toBeLessThan(30_000);
    expect(plan.spans).toHaveLength(plan.segments.reduce((n, s) => n + s.words.length, 0));
  });

  it("finds its story in the fourth segment", () => {
    expect(plan.segments.filter((s) => s.story).map((s) => s.id)).toEqual(["sample-4"]);
  });
});

describe("transcriptAt", () => {
  it("is empty before the first phrase arrives", () => {
    expect(transcriptAt(plan, 0)).toEqual([]);
  });

  it("shows arrived phrases as interim text, never a partial word", () => {
    const first = plan.segments[0]!;
    const [count, atMs] = first.phrases[0]!;
    const segments = transcriptAt(plan, atMs);
    expect(segments).toEqual([
      {
        id: first.id,
        text: first.words
          .slice(0, count)
          .map((w) => w.word)
          .join(" "),
        final: false,
      },
    ]);
    expect(first.text.startsWith(segments[0]!.text)).toBe(true);
  });

  it("finalises a segment after its last word and moves on to the next", () => {
    const first = plan.segments[0]!;
    const second = plan.segments[1]!;
    const at = Math.max(first.finalMs, second.phrases[0]![1]);
    const segments = transcriptAt(plan, at);
    expect(segments[0]).toEqual({ id: first.id, text: first.text, final: true });
    expect(segments[1]).toMatchObject({ id: second.id, final: false });
  });

  it("ends with every segment final", () => {
    const segments = transcriptAt(plan, plan.endMs);
    expect(segments.map((s) => s.final)).toEqual(SAMPLE_ANSWER.map(() => true));
    expect(segments.map((s) => s.text)).toEqual(SAMPLE_ANSWER.map((s) => s.text));
  });
});

describe("sameTranscript", () => {
  it("compares what renders", () => {
    const a = [{ id: "a", text: "It was", final: false }];
    expect(sameTranscript(a, [{ id: "a", text: "It was", final: false }])).toBe(true);
    expect(sameTranscript(a, [{ id: "a", text: "It was", final: true }])).toBe(false);
    expect(sameTranscript(a, [{ id: "a", text: "It was 2", final: false }])).toBe(false);
    expect(sameTranscript(a, [])).toBe(false);
  });
});

describe("storiesDueAt", () => {
  it("finds the story only once its segment is final", () => {
    const segment = plan.segments.find((s) => s.story)!;
    expect(storiesDueAt(plan, segment.finalMs - 1)).toEqual([]);
    expect(storiesDueAt(plan, segment.finalMs).map((s) => s.story?.id)).toEqual([
      "night-shift-fix",
    ]);
  });
});
