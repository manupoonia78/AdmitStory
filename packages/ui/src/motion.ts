// The motion vocabulary (spec §6.6). Every animation in the product uses one of these four
// springs, so the whole interface moves as one piece. Use nothing else: no ad hoc durations,
// no cubic-béziers. CSS transitions use the matching --spring-* easings in tokens.css, which
// are generated from the same numbers (cssSpring below; motion.test.ts keeps them in step).

import { useReducedMotion, type Transition } from "motion/react";

export const SPRINGS = {
  /** Toggles, checkboxes, small state changes. */
  snap: { stiffness: 700, damping: 40, mass: 1 },
  /** Panels, sheets, the dock, layout reflow. */
  glide: { stiffness: 380, damping: 34, mass: 1 },
  /** Hero entrances, shared-element flights, Voiceprint threads. */
  drift: { stiffness: 160, damping: 26, mass: 1.2 },
  /** Ambient breathing and slow ambient motion. */
  settle: { stiffness: 90, damping: 20, mass: 1 },
} as const;

export type MotionToken = keyof typeof SPRINGS;

export const MOTION_TOKENS = Object.keys(SPRINGS) as MotionToken[];

/** A Motion transition for the token. Springs are velocity-based, so a new target mid-flight
 *  carries the current velocity over: every animation built on these is interruptible. */
export function spring(token: MotionToken): Transition {
  return { type: "spring", ...SPRINGS[token] };
}

/** What every spring becomes under prefers-reduced-motion: a 120 ms opacity fade (spec §6.6).
 *  Animate opacity only with it; drop transforms and morphs. */
export const REDUCED_FADE: Transition = { duration: 0.12, ease: "linear" };

/** The token's spring, or REDUCED_FADE when the user prefers reduced motion. */
export function useMotionToken(token: MotionToken): Transition {
  return useReducedMotion() ? REDUCED_FADE : spring(token);
}

/* CSS approximations ------------------------------------------------------------------------ */

const SETTLE_TOLERANCE = 0.001;
const STEP_SECONDS = 1 / 2000;
const CSS_POINTS = 40;

/** Position of a unit spring released at 0 towards 1, sampled every STEP_SECONDS until it has
 *  settled. Semi-implicit Euler at 2 kHz is well inside the accuracy CSS needs. */
function simulate({ stiffness, damping, mass }: (typeof SPRINGS)[MotionToken]): number[] {
  const samples = [0];
  let position = 0;
  let velocity = 0;
  let calmSince = 0;
  for (let step = 1; step < 20_000; step += 1) {
    const force = -stiffness * (position - 1) - damping * velocity;
    velocity += (force / mass) * STEP_SECONDS;
    position += velocity * STEP_SECONDS;
    samples.push(position);
    const calm = Math.abs(position - 1) < SETTLE_TOLERANCE && Math.abs(velocity) < 0.01;
    if (!calm) calmSince = step;
    // Settled once it has stayed within tolerance for 50 ms.
    if (step - calmSince > 100) return samples.slice(0, calmSince + 1);
  }
  return samples;
}

export interface CssSpring {
  /** A CSS linear() easing that traces the spring, overshoot included. */
  easing: string;
  /** How long the spring takes to settle, rounded to 10 ms. */
  durationMs: number;
}

/** The spring as a CSS easing plus duration, for transitions and keyframes. */
export function cssSpring(token: MotionToken): CssSpring {
  const samples = simulate(SPRINGS[token]);
  const last = samples.length - 1;
  const points: string[] = [];
  for (let i = 0; i <= CSS_POINTS; i += 1) {
    const value = i === CSS_POINTS ? 1 : (samples[Math.round((i / CSS_POINTS) * last)] ?? 1);
    points.push(String(Number(value.toFixed(3))));
  }
  return {
    easing: `linear(${points.join(", ")})`,
    durationMs: Math.round((last * STEP_SECONDS * 1000) / 10) * 10,
  };
}
