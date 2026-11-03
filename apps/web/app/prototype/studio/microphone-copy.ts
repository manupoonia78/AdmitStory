// What the Studio says about the microphone in each state (spec §5.2 states, §6.9 copy). Kept
// apart from the screen so the wording is tested; the live mock reuses it in its lobby.

import type { MicrophoneState } from "@admitstory/ui";

export type MicrophoneNotice =
  | { kind: "ask"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "failed"; message: string };

/** The notice for a microphone status; null once it is live. */
export function microphoneNotice(
  status: MicrophoneState["status"],
  appName: string,
): MicrophoneNotice | null {
  switch (status) {
    case "idle":
    case "requesting":
      return {
        kind: "ask",
        message: `${appName} needs your microphone to hear your answers. Audio is turned into text and not kept unless you choose to.`,
      };
    case "denied":
      return {
        kind: "blocked",
        message: "Microphone is blocked in your browser settings. You can keep going by typing.",
      };
    case "unsupported":
      return {
        kind: "blocked",
        message:
          "This browser can't share a microphone with this page. You can keep going by typing.",
      };
    case "error":
      return {
        kind: "failed",
        message: "The microphone didn't start. Check that one is connected, then try again.",
      };
    case "live":
      return null;
  }
}
