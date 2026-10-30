// Live-signal helpers shared by the Studio and the live mock (spec §6.2, §6.6).
//
// followSpring: per-frame visuals that track a live value (the record button's ring following
// amplitude) move on one of the motion.ts springs rather than an ad hoc lerp, so they share the
// product's physics and stay smooth whatever the frame rate.
//
// syntheticSignalAt: a believable voice signal for speech that has word timings but no audio:
// the scripted sample answer in prototypes, the interviewer's voice in a mock without audio
// analysis, and the landing page's "play a sample voice" (spec §6.7). Deterministic, so the same
// script always draws the same Voiceprint.

import { SPRINGS, type MotionToken } from "../motion";
import type { LiveVoiceSignal } from "../voiceprint/types";
import type { WordTiming } from "./word-timing";

export interface SpringState {
  value: number;
  velocity: number;
}

const MAX_STEP_SECONDS = 1 / 240;

/**
 * Advances a spring towards `target` by `dtSeconds`. Long frames are split into small steps so a
 * dropped frame (or a tab coming back) never makes the spring explode.
 */
export function followSpring(
  state: SpringState,
  target: number,
  dtSeconds: number,
  token: MotionToken = "snap",
): SpringState {
  const { stiffness, damping, mass } = SPRINGS[token];
  let { value, velocity } = state;
  let remaining = Math.min(Math.max(dtSeconds, 0), 0.25);
  while (remaining > 0) {
    const dt = Math.min(MAX_STEP_SECONDS, remaining);
    const force = -stiffness * (value - target) - damping * velocity;
    velocity += (force / mass) * dt;
    value += velocity * dt;
    remaining -= dt;
  }
  return { value, velocity };
}

/** A stretch of voiced sound: one word, or a phrase. */
export interface VoicedSpan {
  startMs: number;
  endMs: number;
}

export const SILENT: Readonly<LiveVoiceSignal> = { amplitude: 0, centroid: 0, pitchDelta: 0 };

/** Every word is a voiced span. */
export function spansFromTimings(timings: readonly WordTiming[]): VoicedSpan[] {
  return timings.map(({ startMs, endMs }) => ({ startMs, endMs }));
}

const RELEASE_MS = 90;
const SYLLABLE_HZ = 4.6;

/** Index of the last span that starts at or before `ms`, or -1. */
function spanIndexAt(spans: readonly VoicedSpan[], ms: number): number {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((spans[mid]?.startMs ?? Infinity) <= ms) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

/** Cheap deterministic noise in 0..1. */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43_758.5453;
  return x - Math.floor(x);
}

/**
 * The signal a voice speaking these spans would give at `ms`: amplitude swells over each word
 * with a syllable-rate flutter and decays quickly in gaps; the spectral centroid wanders per word;
 * pitch drifts slowly up and down. Each value is normalised like a real LiveVoiceSignal.
 */
export function syntheticSignalAt(
  spans: readonly VoicedSpan[],
  ms: number,
  seed = 1,
): LiveVoiceSignal {
  const index = spanIndexAt(spans, ms);
  const span = spans[index];
  if (!span) return { ...SILENT };
  const duration = Math.max(1, span.endMs - span.startMs);
  const local = ms - span.startMs;
  let envelope: number;
  if (local <= duration) {
    const p = local / duration;
    envelope = Math.sqrt(Math.sin(Math.PI * Math.min(1, p * 0.85 + 0.075)));
  } else {
    // A short release after the word, then silence until the next.
    envelope = Math.max(0, 1 - (local - duration) / RELEASE_MS) * 0.25;
  }
  if (envelope === 0) return { ...SILENT };
  const stress = 0.62 + 0.38 * hash01(index + seed * 101);
  const flutter = 0.7 + 0.3 * Math.abs(Math.sin((ms / 1000) * Math.PI * SYLLABLE_HZ + seed));
  return {
    amplitude: Math.min(1, envelope * stress * flutter),
    centroid: Math.min(1, 0.3 + 0.45 * hash01(index * 7 + seed) * envelope),
    pitchDelta: Math.max(-1, Math.min(1, Math.sin((ms / 1000) * 1.3 + seed) * 0.8)),
  };
}
