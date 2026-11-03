import { DEFAULT_IDENTITY } from "@admitstory/ui";
import { describe, expect, it } from "vitest";
import { parseStoredIdentity } from "./identity";

const VOICE = {
  version: 1,
  avgPitchHz: 182,
  paceWpm: 158,
  pitchRangeSemitones: 11,
  pauseRhythm: 0.3,
  source: "voice",
} as const;

describe("parseStoredIdentity", () => {
  it("defaults when nothing is stored or the value is not JSON", () => {
    expect(parseStoredIdentity(null)).toEqual({ identity: DEFAULT_IDENTITY, hue: null });
    expect(parseStoredIdentity("{not json")).toEqual({ identity: DEFAULT_IDENTITY, hue: null });
  });

  it("reads back a stored identity and hue", () => {
    expect(parseStoredIdentity(JSON.stringify({ identity: VOICE, hue: 4 }))).toEqual({
      identity: VOICE,
      hue: 4,
    });
  });

  it("drops an identity with missing or wrong fields, and an out-of-range hue", () => {
    const broken = { ...VOICE, paceWpm: "fast", version: 2 };
    expect(parseStoredIdentity(JSON.stringify({ identity: broken, hue: 12 }))).toEqual({
      identity: DEFAULT_IDENTITY,
      hue: null,
    });
    expect(parseStoredIdentity(JSON.stringify({ identity: VOICE, hue: 2.5 })).hue).toBeNull();
  });
});
