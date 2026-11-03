// The springs as plain curves (spec §6.6), for code that animates without Motion: CSS (cssSpring
// in motion.ts) and GSAP on the marketing site. Same simulation, so a GSAP tween on
// springEase("drift") traces exactly the curve --spring-drift does. No motion/react import here:
// the GSAP island must not drag Motion into its chunk.

import { MOTION_TOKENS, SPRINGS, type MotionToken } from "./springs";

const SETTLE_TOLERANCE = 0.001;
/** The simulation step: 2 kHz. */
export const SPRING_STEP_SECONDS = 1 / 2000;

/** Position of a unit spring released at 0 towards 1, sampled every SPRING_STEP_SECONDS until it
 *  has settled. Semi-implicit Euler at 2 kHz is well inside the accuracy CSS needs. */
function simulate({ stiffness, damping, mass }: (typeof SPRINGS)[MotionToken]): number[] {
  const samples = [0];
  let position = 0;
  let velocity = 0;
  let calmSince = 0;
  for (let step = 1; step < 20_000; step += 1) {
    const force = -stiffness * (position - 1) - damping * velocity;
    velocity += (force / mass) * SPRING_STEP_SECONDS;
    position += velocity * SPRING_STEP_SECONDS;
    samples.push(position);
    const calm = Math.abs(position - 1) < SETTLE_TOLERANCE && Math.abs(velocity) < 0.01;
    if (!calm) calmSince = step;
    // Settled once it has stayed within tolerance for 50 ms.
    if (step - calmSince > 100) return samples.slice(0, calmSince + 1);
  }
  return samples;
}

const sampleCache = new Map<MotionToken, readonly number[]>();

/** The token's spring sampled at 2 kHz from release until it settles (first sample 0). */
export function springSamples(token: MotionToken): readonly number[] {
  let samples = sampleCache.get(token);
  if (!samples) {
    samples = Object.freeze(simulate(SPRINGS[token]));
    sampleCache.set(token, samples);
  }
  return samples;
}

/**
 * The spring as an easing over 0..1 progress, for GSAP's `ease` (and anything else that takes a
 * function). It overshoots exactly as the spring does, and is 0 at t ≤ 0 and 1 at t ≥ 1, so a
 * tween always starts and ends on its values.
 */
export function springEase(token: MotionToken): (t: number) => number {
  const samples = springSamples(token);
  const last = samples.length - 1;
  return (t: number) => {
    if (!(t > 0)) return 0;
    if (t >= 1) return 1;
    const position = t * last;
    const index = Math.floor(position);
    const from = samples[index] ?? 1;
    const to = samples[index + 1] ?? 1;
    return from + (to - from) * (position - index);
  };
}

/** Seconds each spring takes to settle, rounded to 10 ms: the tokens.css durations. */
export const SETTLE_SECONDS: Readonly<Record<MotionToken, number>> = Object.freeze(
  Object.fromEntries(
    MOTION_TOKENS.map((token) => [
      token,
      Math.round(((springSamples(token).length - 1) * SPRING_STEP_SECONDS * 1000) / 10) / 100,
    ]),
  ) as Record<MotionToken, number>,
);
