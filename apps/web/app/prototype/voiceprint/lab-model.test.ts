import type { TierDetails } from "@admitstory/ui";
import { describe, expect, it } from "vitest";
import {
  describePauseRhythm,
  describeSource,
  formatClock,
  microphoneMessage,
  splitAnswers,
  tierSummary,
} from "./lab-model";

const details = (inputs: Partial<TierDetails["inputs"]>, tier: 1 | 2 | 3): TierDetails => ({
  tier,
  inputs: {
    reducedMotion: false,
    saveData: false,
    batterySaver: false,
    webgl: true,
    gpu: "high",
    sustainedSlow: false,
    ...inputs,
  },
});

describe("formatClock", () => {
  it("writes minutes and two-digit seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65.9)).toBe("1:05");
    expect(formatClock(180)).toBe("3:00");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("tierSummary", () => {
  it("gives the reason behind the automatic tier", () => {
    expect(tierSummary(details({}, 3))).toBe(
      "Automatic chose tier 3 (full) because the GPU is rated high.",
    );
    expect(tierSummary(details({ gpu: "mid" }, 2))).toContain("mid-range");
    expect(tierSummary(details({ sustainedSlow: true }, 2))).toContain("frames were running slow");
    expect(tierSummary(details({ saveData: true }, 1))).toContain("Save-Data is on");
    expect(tierSummary(details({ webgl: false }, 1))).toContain("no WebGL");
    expect(tierSummary(details({ gpu: "pending" }, 1))).toContain("still being checked");
  });

  it("says reduced motion keeps every tier still", () => {
    expect(tierSummary(details({ reducedMotion: true }, 1))).toBe(
      "Reduced motion is on, so the Voiceprint stays still at every tier.",
    );
  });
});

describe("describePauseRhythm and describeSource", () => {
  it("puts the numbers into words", () => {
    expect(describePauseRhythm(0.1)).toBe("even");
    expect(describePauseRhythm(0.5)).toBe("varied");
    expect(describePauseRhythm(0.9)).toBe("irregular");
    expect(describeSource("voice")).toBe("Your voice");
    expect(describeSource("text")).toBe("Your writing");
    expect(describeSource("default")).toMatch(/^Default/);
  });
});

describe("splitAnswers", () => {
  it("treats each paragraph as one answer", () => {
    expect(splitAnswers("First answer.\nStill first.\n\n  Second answer. \n\n\n")).toEqual([
      "First answer.\nStill first.",
      "Second answer.",
    ]);
    expect(splitAnswers("   ")).toEqual([]);
  });
});

describe("microphoneMessage", () => {
  it("uses the spec's permission and denied copy with the product name", () => {
    expect(microphoneMessage("idle", "AdmitStory")).toBe(
      "AdmitStory needs your microphone to hear your answers. Audio is turned into text and not kept unless you choose to.",
    );
    expect(microphoneMessage("denied", "AdmitStory")).toBe(
      "Microphone is blocked in your browser settings. You can keep going by typing.",
    );
  });

  it("never shouts", () => {
    for (const status of [
      "idle",
      "requesting",
      "live",
      "denied",
      "unsupported",
      "error",
    ] as const) {
      expect(microphoneMessage(status, "AdmitStory")).not.toMatch(/!|Oops|Something went wrong/);
    }
  });
});
