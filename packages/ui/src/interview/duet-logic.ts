// Pure parts of the live-mock duet stage (spec §6.2, §6.7 "Live mock", §6.10 J).

import type { LiveVoiceSignal, VoiceprintMood } from "../voiceprint/types";

export type DuetSpeaker = "you" | "interviewer" | null;

/**
 * Each form responds to whoever is speaking (spec §6.2): the speaker's form speaks, the other
 * listens (calmer, cooler). Between turns, and while the mock is paused, both rest.
 */
export function duetMoods(
  speaker: DuetSpeaker,
  paused = false,
): { you: VoiceprintMood; interviewer: VoiceprintMood } {
  if (paused || speaker === null) return { you: "idle", interviewer: "idle" };
  return speaker === "you"
    ? { you: "speaking", interviewer: "listening" }
    : { you: "listening", interviewer: "speaking" };
}

/** How strongly a listening form echoes the speaker's voice. */
export const RESONANCE_GAIN = 0.22;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * A listening form's signal: its own (silence, mostly) plus a faint echo of the speaker's, so it
 * visibly reacts to being spoken to without looking like it is talking.
 */
export function resonate(
  own: LiveVoiceSignal,
  other: LiveVoiceSignal,
  gain: number,
): LiveVoiceSignal {
  return {
    amplitude: clamp(own.amplitude + other.amplitude * gain, 0, 1),
    centroid: clamp(Math.max(own.centroid, other.centroid * gain), 0, 1),
    pitchDelta: clamp(own.pitchDelta + other.pitchDelta * gain, -1, 1),
  };
}

/** The session clock: "04:12", "18:42", and "1:02:03" past an hour. Never negative. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${String(minutes).padStart(2, "0")}:${ss}`;
}

/** The same duration for a machine-readable <time dateTime>: "PT18M42S". */
export function elapsedDateTime(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${total % 60}S`;
}
