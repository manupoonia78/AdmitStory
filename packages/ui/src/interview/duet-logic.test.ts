import { describe, expect, it } from "vitest";
import { duetMoods, elapsedDateTime, formatElapsed, resonate } from "./duet-logic";

describe("duetMoods", () => {
  it("makes the speaker speak and the other listen", () => {
    expect(duetMoods("interviewer")).toEqual({ you: "listening", interviewer: "speaking" });
    expect(duetMoods("you")).toEqual({ you: "speaking", interviewer: "listening" });
  });

  it("rests both between turns and while paused", () => {
    expect(duetMoods(null)).toEqual({ you: "idle", interviewer: "idle" });
    expect(duetMoods("you", true)).toEqual({ you: "idle", interviewer: "idle" });
  });
});

describe("resonate", () => {
  const silent = { amplitude: 0, centroid: 0, pitchDelta: 0 };
  const loud = { amplitude: 0.9, centroid: 0.6, pitchDelta: -0.8 };

  it("echoes the speaker faintly in a silent listener", () => {
    const echo = resonate(silent, loud, 0.2);
    expect(echo.amplitude).toBeCloseTo(0.18);
    expect(echo.centroid).toBeCloseTo(0.12);
    expect(echo.pitchDelta).toBeCloseTo(-0.16);
  });

  it("keeps every value in range", () => {
    const echo = resonate(loud, { amplitude: 1, centroid: 1, pitchDelta: -1 }, 1);
    expect(echo.amplitude).toBe(1);
    expect(echo.centroid).toBe(1);
    expect(echo.pitchDelta).toBe(-1);
  });

  it("changes nothing with no gain", () => {
    expect(resonate(silent, loud, 0)).toEqual(silent);
  });
});

describe("formatElapsed", () => {
  it("shows minutes and seconds, padded", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(252_400)).toBe("04:12");
    expect(formatElapsed(18 * 60_000 + 42_999)).toBe("18:42");
  });

  it("adds hours past an hour and never goes negative", () => {
    expect(formatElapsed(3_723_000)).toBe("1:02:03");
    expect(formatElapsed(-5000)).toBe("00:00");
    expect(formatElapsed(Number.NaN)).toBe("00:00");
  });

  it("has a machine-readable form", () => {
    expect(elapsedDateTime(18 * 60_000 + 42_000)).toBe("PT18M42S");
    expect(elapsedDateTime(3_723_000)).toBe("PT1H2M3S");
    expect(elapsedDateTime(0)).toBe("PT0S");
  });
});
