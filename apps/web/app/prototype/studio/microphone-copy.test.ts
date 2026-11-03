import { describe, expect, it } from "vitest";
import { microphoneNotice } from "./microphone-copy";

describe("microphoneNotice", () => {
  it("asks with the spec's explanation, naming the product", () => {
    for (const status of ["idle", "requesting"] as const) {
      expect(microphoneNotice(status, "AdmitStory")).toEqual({
        kind: "ask",
        message:
          "AdmitStory needs your microphone to hear your answers. Audio is turned into text and not kept unless you choose to.",
      });
    }
  });

  it("uses the spec's blocked copy and offers typing", () => {
    expect(microphoneNotice("denied", "AdmitStory")).toEqual({
      kind: "blocked",
      message: "Microphone is blocked in your browser settings. You can keep going by typing.",
    });
    expect(microphoneNotice("unsupported", "AdmitStory")?.kind).toBe("blocked");
  });

  it("says what to check when the microphone fails, and nothing once it is live", () => {
    expect(microphoneNotice("error", "AdmitStory")?.kind).toBe("failed");
    expect(microphoneNotice("live", "AdmitStory")).toBeNull();
  });

  it("never shouts", () => {
    for (const status of ["idle", "denied", "unsupported", "error"] as const) {
      expect(microphoneNotice(status, "AdmitStory")?.message).not.toMatch(/!/);
    }
  });
});
