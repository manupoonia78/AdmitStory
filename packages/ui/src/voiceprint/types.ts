// The Voiceprint contract (spec §6.2). These names and shapes are shared by every screen that
// shows a Voiceprint; implementations behind them may change, the types may only grow.

// The identity parameters live in packages/shared (the server computes them too); re-exported here
// so the Voiceprint contract still reads as one type set.
export type { VoiceprintIdentity } from "@admitstory/shared";
import type { VoiceprintIdentity } from "@admitstory/shared";

/** What the renderer draws, derived from an identity by paramsFromIdentity(). */
export interface VoiceprintParams {
  /** The identity's own hue, 0..11 (VOICE_HUES). The applicant may swap it in Settings. */
  hueIndex: number;
  filamentCount: number;
  swirlSpeed: number;
  /** 0 (round) to 1 (lopsided). */
  asymmetry: number;
  seed: number;
}

/** Live parameters, updated per frame while someone speaks. Each is normalised. */
export interface LiveVoiceSignal {
  /** 0..1, drives scale and particle energy. */
  amplitude: number;
  /** 0..1 spectral centroid, drives filament sharpness. */
  centroid: number;
  /** -1..1 pitch movement, drives swirl direction. */
  pitchDelta: number;
}

/** Mutated in place every frame, never React state, so speaking never re-renders anything. */
export type VoiceSignalRef = { current: LiveVoiceSignal };

/** "listening": calmer and cooler while the interviewer's question is read aloud.
 *  "seed": the faint newborn form of first run. */
export type VoiceprintMood = "idle" | "speaking" | "listening" | "seed";

/** Spec §6.11: 3 full, 2 lite, 1 still (SVG). */
export type PerformanceTier = 1 | 2 | 3;

export interface VoiceprintProps {
  identity: VoiceprintIdentity;
  signal?: VoiceSignalRef | null;
  mood?: VoiceprintMood;
  /** Pixels, or "fill" to fill the parent (which must have a size). */
  size: number | "fill";
  /** "silver" is the interviewer's neutral form in live mocks; "voice" uses the nearest hue. */
  tone?: "voice" | "silver";
  /** Force a tier (prototype HUD, tests); otherwise it is chosen at runtime. */
  tier?: PerformanceTier;
  /** Accessible name, e.g. "Your Voiceprint". */
  label: string;
  className?: string;
}

export interface MicrophoneState {
  status: "idle" | "requesting" | "live" | "denied" | "unsupported" | "error";
  start(): Promise<void>;
  stop(): void;
  signal: VoiceSignalRef;
  /** The live stream and its context while `live`, for dictation to share; otherwise null. */
  audio(): { context: AudioContext; stream: MediaStream } | null;
}
