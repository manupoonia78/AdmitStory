import { describe, expect, it } from "vitest";
import { DEFAULT_IDENTITY, paramsFromIdentity } from "./params";
import type { VoiceprintIdentity } from "./types";

const identity = (overrides: Partial<VoiceprintIdentity>): VoiceprintIdentity => ({
  ...DEFAULT_IDENTITY,
  source: "voice",
  ...overrides,
});

describe("paramsFromIdentity", () => {
  it("is deterministic", () => {
    expect(paramsFromIdentity(DEFAULT_IDENTITY)).toEqual(
      paramsFromIdentity({ ...DEFAULT_IDENTITY }),
    );
  });

  it("keeps every parameter in range, even for odd input", () => {
    for (const odd of [
      identity({ avgPitchHz: 0, paceWpm: 0, pitchRangeSemitones: -4, pauseRhythm: -1 }),
      identity({ avgPitchHz: 2000, paceWpm: 900, pitchRangeSemitones: 80, pauseRhythm: 9 }),
      identity({ avgPitchHz: Number.NaN, pauseRhythm: Number.NaN }),
    ]) {
      const params = paramsFromIdentity(odd);
      expect(params.hueIndex).toBeGreaterThanOrEqual(0);
      expect(params.hueIndex).toBeLessThan(12);
      expect(Number.isInteger(params.hueIndex)).toBe(true);
      expect(params.filamentCount).toBeGreaterThanOrEqual(5);
      expect(params.filamentCount).toBeLessThanOrEqual(13);
      expect(params.asymmetry).toBeGreaterThanOrEqual(0);
      expect(params.asymmetry).toBeLessThanOrEqual(1);
      expect(params.swirlSpeed).toBeGreaterThan(0);
    }
  });

  it("maps each identity number to its parameter", () => {
    expect(paramsFromIdentity(identity({ pitchRangeSemitones: 18 })).filamentCount).toBeGreaterThan(
      paramsFromIdentity(identity({ pitchRangeSemitones: 4 })).filamentCount,
    );
    expect(paramsFromIdentity(identity({ paceWpm: 190 })).swirlSpeed).toBeGreaterThan(
      paramsFromIdentity(identity({ paceWpm: 110 })).swirlSpeed,
    );
    expect(paramsFromIdentity(identity({ pauseRhythm: 0.9 })).asymmetry).toBeGreaterThan(
      paramsFromIdentity(identity({ pauseRhythm: 0.1 })).asymmetry,
    );
  });

  it("gives close but different speakers different seeds", () => {
    const a = paramsFromIdentity(identity({ avgPitchHz: 180 }));
    const b = paramsFromIdentity(identity({ avgPitchHz: 180.4 }));
    expect(a.seed).not.toBe(b.seed);
  });

  it("gives clearly different speakers visibly different Voiceprints", () => {
    const low = paramsFromIdentity(
      identity({ avgPitchHz: 105, paceWpm: 115, pitchRangeSemitones: 4, pauseRhythm: 0.15 }),
    );
    const high = paramsFromIdentity(
      identity({ avgPitchHz: 230, paceWpm: 185, pitchRangeSemitones: 16, pauseRhythm: 0.8 }),
    );
    expect(high.hueIndex).not.toBe(low.hueIndex);
    expect(high.filamentCount - low.filamentCount).toBeGreaterThanOrEqual(4);
    expect(high.swirlSpeed - low.swirlSpeed).toBeGreaterThanOrEqual(0.5);
    expect(high.asymmetry - low.asymmetry).toBeGreaterThanOrEqual(0.4);
  });

  it("spreads typical voices across most of the 12 hues", () => {
    const hues = new Set<number>();
    for (let pitch = 85; pitch <= 260; pitch += 5) {
      for (const pace of [110, 140, 170, 200]) {
        hues.add(paramsFromIdentity(identity({ avgPitchHz: pitch, paceWpm: pace })).hueIndex);
      }
    }
    expect(hues.size).toBeGreaterThanOrEqual(10);
  });
});
