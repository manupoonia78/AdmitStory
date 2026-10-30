// Wording and formatting for the Voiceprint review lab. Pure, so the copy is tested (spec §6.9:
// sentence case, plain words, no exclamation marks).

import type {
  MicrophoneState,
  PerformanceTier,
  TierDetails,
  VoiceprintIdentity,
} from "@admitstory/ui";

export const TIER_NAMES: Record<PerformanceTier, string> = { 1: "still", 2: "lite", 3: "full" };

/** "1:05" for 65 seconds. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Why the automatic tier is what it is, in one sentence. */
export function tierSummary({ tier, inputs }: TierDetails): string {
  if (inputs.reducedMotion) {
    return "Reduced motion is on, so the Voiceprint stays still at every tier.";
  }
  let reason: string;
  if (inputs.saveData) reason = "Save-Data is on";
  else if (inputs.batterySaver) reason = "the battery is low";
  else if (!inputs.webgl) reason = "this browser has no WebGL";
  else if (inputs.gpu === "pending") reason = "the GPU is still being checked";
  else if (inputs.gpu === "low") reason = "the GPU is rated low";
  else if (inputs.sustainedSlow) reason = "frames were running slow";
  else if (inputs.gpu === "mid") reason = "the GPU is rated mid-range";
  else if (inputs.gpu === "unknown") reason = "the GPU isn't in the benchmark list";
  else reason = "the GPU is rated high";
  return `Automatic chose tier ${tier} (${TIER_NAMES[tier]}) because ${reason}.`;
}

/** Pause rhythm in words, beside the number. */
export function describePauseRhythm(value: number): string {
  if (value < 0.34) return "even";
  if (value < 0.67) return "varied";
  return "irregular";
}

export function describeSource(source: VoiceprintIdentity["source"]): string {
  switch (source) {
    case "voice":
      return "Your voice";
    case "text":
      return "Your writing";
    default:
      return "Default, until you speak or write";
  }
}

/** Answers pasted into the writing box: one per paragraph (blank lines between them). */
export function splitAnswers(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((answer) => answer.trim())
    .filter(Boolean);
}

/** What to say about the microphone, by status (spec §6.9 for permission and denied). */
export function microphoneMessage(status: MicrophoneState["status"], appName: string): string {
  switch (status) {
    case "idle":
    case "requesting":
      return `${appName} needs your microphone to hear your answers. Audio is turned into text and not kept unless you choose to.`;
    case "live":
      return "Your Voiceprint is listening. Speak and watch it move.";
    case "denied":
      return "Microphone is blocked in your browser settings. You can keep going by typing.";
    case "unsupported":
      return "This browser can't share a microphone with this page. You can keep going by typing.";
    case "error":
      return "The microphone didn't start. Check that one is connected, then try again.";
  }
}

/** Synthetic answers from a fictional applicant, for trying the writing path quickly. */
export const SAMPLE_ANSWERS = `I grew up in a coastal town where the ferry schedule decided everything. When it ran late, the market opened late, and my mother's stall lost its best hour.

At nineteen I built a small text alert for the stall owners, so they knew the ferry's real arrival time. Forty people used it within a month. I learned that the hardest part was not the code; it was getting everyone to trust a message from a teenager.

Now I run operations for a regional logistics firm. I still think about that ferry.`;
