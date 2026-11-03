import { describe, expect, it } from "vitest";
import { followSpring, spansFromTimings, syntheticSignalAt } from "./synthetic-signal";
import { estimateWordTimings } from "./word-timing";

describe("followSpring", () => {
  it("settles on the target", () => {
    let state = { value: 0, velocity: 0 };
    for (let frame = 0; frame < 120; frame += 1) state = followSpring(state, 1, 1 / 60);
    expect(state.value).toBeCloseTo(1, 3);
    expect(Math.abs(state.velocity)).toBeLessThan(0.01);
  });

  it("is frame-rate independent", () => {
    let at60 = { value: 0, velocity: 0 };
    let at120 = { value: 0, velocity: 0 };
    for (let i = 0; i < 12; i += 1) at60 = followSpring(at60, 1, 1 / 60);
    for (let i = 0; i < 24; i += 1) at120 = followSpring(at120, 1, 1 / 120);
    expect(at60.value).toBeCloseTo(at120.value, 2);
  });

  it("survives a long dropped frame without blowing up", () => {
    const state = followSpring({ value: 0, velocity: 0 }, 1, 5);
    expect(Number.isFinite(state.value)).toBe(true);
    expect(state.value).toBeGreaterThan(0.5);
    expect(state.value).toBeLessThan(1.1);
  });

  it("uses the token's spring: snap gets there before settle", () => {
    const snap = followSpring({ value: 0, velocity: 0 }, 1, 0.1, "snap");
    const settle = followSpring({ value: 0, velocity: 0 }, 1, 0.1, "settle");
    expect(snap.value).toBeGreaterThan(settle.value);
  });
});

describe("syntheticSignalAt", () => {
  const spans = spansFromTimings(
    estimateWordTimings("It was two in the morning.", { startMs: 1000 }),
  );

  it("is silent before the first word and long after the last", () => {
    expect(syntheticSignalAt(spans, 0).amplitude).toBe(0);
    expect(syntheticSignalAt(spans, 60_000).amplitude).toBe(0);
  });

  it("is voiced in the middle of a word, with every value in range", () => {
    for (const span of spans) {
      const signal = syntheticSignalAt(spans, (span.startMs + span.endMs) / 2);
      expect(signal.amplitude).toBeGreaterThan(0.2);
      expect(signal.amplitude).toBeLessThanOrEqual(1);
      expect(signal.centroid).toBeGreaterThanOrEqual(0);
      expect(signal.centroid).toBeLessThanOrEqual(1);
      expect(signal.pitchDelta).toBeGreaterThanOrEqual(-1);
      expect(signal.pitchDelta).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for the same seed and differs between seeds", () => {
    const ms = (spans[2]!.startMs + spans[2]!.endMs) / 2;
    expect(syntheticSignalAt(spans, ms, 3)).toEqual(syntheticSignalAt(spans, ms, 3));
    expect(syntheticSignalAt(spans, ms, 3)).not.toEqual(syntheticSignalAt(spans, ms, 4));
  });
});
