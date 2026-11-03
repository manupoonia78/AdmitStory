// How the live Voiceprint moves (spec §6.2, §6.6). Every moving number is a spring from
// motion.ts stepped once per frame, so mood changes, voice reactions and breathing all share the
// product's one physics vocabulary, and any new target simply redirects a spring mid-flight.
// Pure: the WebGL renderer reads the result as uniforms; the tests read it as numbers.

import { SPRINGS, type MotionToken } from "../motion";
import type { LiveVoiceSignal, VoiceprintMood } from "./types";

export interface SpringState {
  value: number;
  velocity: number;
}

// Semi-implicit Euler is stable for the stiffest token (snap) at steps up to ~4 ms.
const MAX_STEP_S = 1 / 240;

/** Advances a spring towards `target` by `dt` seconds, in place. */
export function stepSpring(
  state: SpringState,
  target: number,
  token: MotionToken,
  dt: number,
): SpringState {
  const { stiffness, damping, mass } = SPRINGS[token];
  let remaining = Math.max(0, dt);
  while (remaining > 0) {
    const step = Math.min(MAX_STEP_S, remaining);
    const force = -stiffness * (state.value - target) - damping * state.velocity;
    state.velocity += (force / mass) * step;
    state.value += state.velocity * step;
    remaining -= step;
  }
  return state;
}

/** What each mood asks of the form. Springs carry it from one mood to the next. */
export interface MoodTargets {
  /** Overall size; 1 matches the still render's proportions. */
  scale: number;
  brightness: number;
  /** How strongly the live voice moves it. */
  voiceGain: number;
  swirl: number;
  /** Speed of the light packets travelling along the filaments. */
  flow: number;
  /** 0 the applicant's hue, 1 shifted towards a cool tint ("listening"). */
  cool: number;
  /** Depth of the idle breath. */
  breath: number;
}

export const MOOD_TARGETS: Record<VoiceprintMood, MoodTargets> = {
  idle: { scale: 0.94, brightness: 0.85, voiceGain: 1, swirl: 1, flow: 1, cool: 0, breath: 0.035 },
  speaking: {
    scale: 0.96,
    brightness: 1,
    voiceGain: 1.25,
    swirl: 1.2,
    flow: 1.35,
    cool: 0,
    breath: 0.012,
  },
  // Calmer and cooler while the interviewer's question is read aloud.
  listening: {
    scale: 0.88,
    brightness: 0.62,
    voiceGain: 0.35,
    swirl: 0.45,
    flow: 0.55,
    cool: 1,
    breath: 0.03,
  },
  // First run: a faint, small seed.
  seed: {
    scale: 0.5,
    brightness: 0.4,
    voiceGain: 0.5,
    swirl: 0.6,
    flow: 0.6,
    cool: 0,
    breath: 0.05,
  },
};

/** Half a breath: the idle target flips this often and the settle spring follows it. */
export const BREATH_HALF_PERIOD_S = 2.4;
/** How far amplitude grows the form at full voice. */
const VOICE_SCALE = 0.1;
/** Swirl direction from pitch movement: rising pitch turns one way, falling the other. */
const PITCH_SWIRL = 2.2;
const BASE_SWIRL_RATE = 0.35;
const BASE_FLOW_RATE = 0.18;

export interface Dynamics {
  time: number;
  scale: SpringState;
  brightness: SpringState;
  voiceGain: SpringState;
  swirlRate: SpringState;
  flowRate: SpringState;
  cool: SpringState;
  breathDepth: SpringState;
  energy: SpringState;
  sharpness: SpringState;
  direction: SpringState;
  breath: SpringState;
  breathTarget: 0 | 1;
  breathClock: number;
  swirl: number;
  flow: number;
}

/** What the renderer draws this frame. */
export interface FrameValues {
  time: number;
  scale: number;
  brightness: number;
  /** 0..1+, particle energy from the voice (springs may overshoot a little). */
  energy: number;
  /** 0 soft .. 1 sharp filaments, from the spectral centroid. */
  sharpness: number;
  /** Accumulated swirl angle, radians. */
  swirl: number;
  /** Accumulated flow phase along the filaments. */
  flow: number;
  cool: number;
}

const at = (value: number): SpringState => ({ value, velocity: 0 });

export function createDynamics(mood: VoiceprintMood = "idle"): Dynamics {
  const targets = MOOD_TARGETS[mood];
  return {
    time: 0,
    scale: at(targets.scale),
    brightness: at(targets.brightness),
    voiceGain: at(targets.voiceGain),
    swirlRate: at(targets.swirl),
    flowRate: at(targets.flow),
    cool: at(targets.cool),
    breathDepth: at(targets.breath),
    energy: at(0),
    sharpness: at(0.5),
    direction: at(1),
    breath: at(0),
    breathTarget: 1,
    breathClock: 0,
    swirl: 0,
    flow: 0,
  };
}

export interface DynamicsInput {
  mood: VoiceprintMood;
  /** The identity's swirl speed (paramsFromIdentity). */
  swirlSpeed: number;
  signal: LiveVoiceSignal | null;
}

/** Steps every spring by `dt` seconds and returns the frame's values. Mutates `d`. */
export function stepDynamics(d: Dynamics, dt: number, input: DynamicsInput): FrameValues {
  const targets = MOOD_TARGETS[input.mood];
  d.time += dt;

  // Mood changes are hero-scale moves: drift.
  stepSpring(d.scale, targets.scale, "drift", dt);
  stepSpring(d.brightness, targets.brightness, "drift", dt);
  stepSpring(d.voiceGain, targets.voiceGain, "drift", dt);
  stepSpring(d.swirlRate, targets.swirl, "drift", dt);
  stepSpring(d.flowRate, targets.flow, "drift", dt);
  stepSpring(d.cool, targets.cool, "drift", dt);
  stepSpring(d.breathDepth, targets.breath, "drift", dt);

  // Breathing: the settle spring chasing a target that flips every half breath.
  d.breathClock += dt;
  if (d.breathClock >= BREATH_HALF_PERIOD_S) {
    d.breathClock %= BREATH_HALF_PERIOD_S;
    d.breathTarget = d.breathTarget === 1 ? 0 : 1;
  }
  stepSpring(d.breath, d.breathTarget, "settle", dt);

  // The voice: amplitude reacts on snap (it has to feel instant), timbre on glide, and the
  // swirl's direction turns on drift so a pitch wobble doesn't jerk the whole form.
  const gain = Math.max(0, d.voiceGain.value);
  const amplitude = (input.signal?.amplitude ?? 0) * gain;
  const centroid = input.signal ? input.signal.centroid : 0.5;
  const pitchDelta = (input.signal?.pitchDelta ?? 0) * Math.min(1, gain);
  stepSpring(d.energy, amplitude, "snap", dt);
  stepSpring(
    d.sharpness,
    input.signal && input.signal.amplitude > 0.02 ? centroid : 0.5,
    "glide",
    dt,
  );
  stepSpring(d.direction, 1 + PITCH_SWIRL * pitchDelta, "drift", dt);

  d.swirl += dt * BASE_SWIRL_RATE * input.swirlSpeed * d.swirlRate.value * d.direction.value;
  d.flow += dt * BASE_FLOW_RATE * d.flowRate.value * (1 + d.energy.value);

  const energy = Math.max(0, d.energy.value);
  return {
    time: d.time,
    scale:
      d.scale.value * (1 + VOICE_SCALE * energy + d.breathDepth.value * (d.breath.value - 0.5)),
    brightness: Math.max(0, d.brightness.value) * (0.9 + 0.25 * Math.min(1, energy)),
    energy,
    sharpness: Math.min(1, Math.max(0, d.sharpness.value)),
    swirl: d.swirl,
    flow: d.flow,
    cool: Math.min(1, Math.max(0, d.cool.value)),
  };
}
