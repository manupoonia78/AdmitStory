// The motion vocabulary (SPEC §2.10). Two kinds, each with one job, so the whole interface
// moves as one piece:
//
//  - Springs, for things the user moves: toggles, presses, panels, sheets, tab rules, flights.
//    Velocity-based, so they can be interrupted. CSS uses the matching --spring-* easings in
//    tokens.css, generated from the same numbers (cssSpring below; motion.test.ts keeps them in
//    step).
//  - Eases with fixed durations, for choreography: entrances, reveals, a line drawing. These
//    are the --ease-* and --dur-* tokens; EASES and DURATIONS below are the same values for
//    Motion.
//
// Use nothing else: no ad hoc durations or curves.

import { useReducedMotion, type Transition } from "motion/react";
import { SPRING_STEP_SECONDS, springSamples } from "./motion-curves";
import { SPRINGS, type MotionToken } from "./springs";

export { MOTION_TOKENS, SPRINGS, type MotionToken } from "./springs";

/** The choreography curves, as Motion cubic-bezier arrays. Same values as --ease-* in tokens.css. */
export const EASES = {
  /** Every entrance and reveal. */
  rise: [0.22, 1, 0.36, 1],
  /** Things leaving. */
  exit: [0.4, 0, 1, 1],
  /** A line drawing or settling. */
  line: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EaseToken = keyof typeof EASES;

/** The choreography durations in milliseconds. Same values as --dur-* in tokens.css. */
export const DURATIONS = {
  press: 100,
  hover: 200,
  swap: 250,
  reveal: 600,
  enter: 800,
  draw: 900,
} as const;

export type DurationToken = keyof typeof DURATIONS;

/** A Motion transition for a choreographed move: a fixed duration on one of the three curves. */
export function ease(duration: DurationToken, curve: EaseToken = "rise"): Transition {
  return { duration: DURATIONS[duration] / 1000, ease: [...EASES[curve]] };
}

/** A Motion transition for the token. Springs are velocity-based, so a new target mid-flight
 *  carries the current velocity over: every animation built on these is interruptible. */
export function spring(token: MotionToken): Transition {
  return { type: "spring", ...SPRINGS[token] };
}

/** What every spring and ease becomes under prefers-reduced-motion: a 120 ms opacity fade.
 *  Animate opacity only with it; drop transforms and morphs. */
export const REDUCED_FADE: Transition = { duration: 0.12, ease: "linear" };

/** The token's spring, or REDUCED_FADE when the user prefers reduced motion. */
export function useMotionToken(token: MotionToken): Transition {
  return useReducedMotion() ? REDUCED_FADE : spring(token);
}

/* CSS approximations ------------------------------------------------------------------------ */

const CSS_POINTS = 40;

export interface CssSpring {
  /** A CSS linear() easing that traces the spring, overshoot included. */
  easing: string;
  /** How long the spring takes to settle, rounded to 10 ms. */
  durationMs: number;
}

/** The spring as a CSS easing plus duration, for transitions and keyframes. */
export function cssSpring(token: MotionToken): CssSpring {
  const samples = springSamples(token);
  const last = samples.length - 1;
  const points: string[] = [];
  for (let i = 0; i <= CSS_POINTS; i += 1) {
    const value = i === CSS_POINTS ? 1 : (samples[Math.round((i / CSS_POINTS) * last)] ?? 1);
    points.push(String(Number(value.toFixed(3))));
  }
  return {
    easing: `linear(${points.join(", ")})`,
    durationMs: Math.round((last * SPRING_STEP_SECONDS * 1000) / 10) * 10,
  };
}
