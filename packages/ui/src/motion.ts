// The motion vocabulary (spec §6.6). Every animation in the product uses one of these four
// springs, so the whole interface moves as one piece. Use nothing else: no ad hoc durations,
// no cubic-béziers. CSS transitions use the matching --spring-* easings in tokens.css, which
// are generated from the same numbers (cssSpring below; motion.test.ts keeps them in step).

import { useReducedMotion, type Transition } from "motion/react";
import { SPRING_STEP_SECONDS, springSamples } from "./motion-curves";
import { SPRINGS, type MotionToken } from "./springs";

export { MOTION_TOKENS, SPRINGS, type MotionToken } from "./springs";

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
