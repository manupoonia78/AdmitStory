import { describe, expect, it } from "vitest";
import {
  BREATH_HALF_PERIOD_S,
  MOOD_TARGETS,
  createDynamics,
  stepDynamics,
  stepSpring,
  type DynamicsInput,
  type FrameValues,
} from "./choreography";

const FRAME = 1 / 120;

function run(
  seconds: number,
  input: DynamicsInput,
  dynamics = createDynamics(input.mood),
): { values: FrameValues[]; dynamics: ReturnType<typeof createDynamics> } {
  const values: FrameValues[] = [];
  for (let t = 0; t < seconds; t += FRAME) values.push(stepDynamics(dynamics, FRAME, input));
  return { values, dynamics };
}

describe("stepSpring", () => {
  it("settles on the target for every token", () => {
    for (const token of ["snap", "glide", "drift", "settle"] as const) {
      const state = { value: 0, velocity: 0 };
      for (let i = 0; i < 240; i += 1) stepSpring(state, 1, token, FRAME);
      expect(state.value).toBeCloseTo(1, 2);
    }
  });

  it("is interruptible: a new target mid-flight keeps the velocity", () => {
    const state = { value: 0, velocity: 0 };
    for (let i = 0; i < 6; i += 1) stepSpring(state, 1, "glide", FRAME);
    expect(state.velocity).toBeGreaterThan(0);
    const velocity = state.velocity;
    stepSpring(state, -1, "glide", FRAME);
    // Turning round takes time: no jump in position, no reset of velocity.
    expect(state.velocity).toBeGreaterThan(0);
    expect(state.velocity).toBeLessThan(velocity);
  });

  it("orders the tokens from quickest to slowest", () => {
    const after = (token: "snap" | "glide" | "drift" | "settle") => {
      const state = { value: 0, velocity: 0 };
      stepSpring(state, 1, token, 0.1);
      return state.value;
    };
    expect(after("snap")).toBeGreaterThan(after("glide"));
    expect(after("glide")).toBeGreaterThan(after("drift"));
    expect(after("drift")).toBeGreaterThan(after("settle"));
  });

  it("does nothing for no time", () => {
    expect(stepSpring({ value: 0.3, velocity: 0 }, 1, "snap", 0)).toEqual({
      value: 0.3,
      velocity: 0,
    });
  });
});

describe("stepDynamics", () => {
  const quiet: DynamicsInput = { mood: "idle", swirlSpeed: 1, signal: null };

  it("breathes when idle, with the period of two half breaths", () => {
    const { values } = run(BREATH_HALF_PERIOD_S * 4, quiet);
    const scales = values.map((v) => v.scale);
    const spread = Math.max(...scales) - Math.min(...scales);
    expect(spread).toBeGreaterThan(MOOD_TARGETS.idle.scale * MOOD_TARGETS.idle.breath * 0.6);
    expect(spread).toBeLessThan(0.08);
  });

  it("grows and energises with a loud voice", () => {
    const loud = run(1, { ...quiet, signal: { amplitude: 1, centroid: 0.8, pitchDelta: 0 } });
    const silent = run(1, quiet);
    const last = loud.values.at(-1)!;
    expect(last.energy).toBeGreaterThan(0.9);
    expect(last.scale).toBeGreaterThan(silent.values.at(-1)!.scale);
    expect(last.sharpness).toBeGreaterThan(0.7);
  });

  it("turns the swirl round when pitch falls, and back when it rises", () => {
    const swirlAfter = (pitchDelta: number) => {
      const { values } = run(2, {
        ...quiet,
        signal: { amplitude: 0.5, centroid: 0.5, pitchDelta },
      });
      return values.at(-1)!.swirl - values.at(-31)!.swirl;
    };
    expect(swirlAfter(0.8)).toBeGreaterThan(0);
    expect(swirlAfter(-0.8)).toBeLessThan(0);
  });

  it("calms and cools while listening, and shrinks to a faint seed", () => {
    const idle = run(2, quiet).values.at(-1)!;
    const listening = run(2, { ...quiet, mood: "listening" }).values.at(-1)!;
    const seed = run(2, { ...quiet, mood: "seed" }).values.at(-1)!;
    expect(listening.cool).toBeGreaterThan(0.9);
    expect(listening.brightness).toBeLessThan(idle.brightness);
    expect(seed.scale).toBeLessThan(idle.scale * 0.6);
    expect(seed.brightness).toBeLessThan(idle.brightness * 0.6);
  });

  it("carries a mood change on a spring instead of jumping", () => {
    const { dynamics } = run(1, quiet);
    const before = dynamics.scale.value;
    const next = stepDynamics(dynamics, FRAME, { ...quiet, mood: "seed" });
    expect(dynamics.scale.value).toBeLessThanOrEqual(before);
    expect(before - dynamics.scale.value).toBeLessThan(0.01);
    expect(next.scale).toBeGreaterThan(MOOD_TARGETS.seed.scale);
  });

  it("damps the voice while listening", () => {
    const signal = { amplitude: 1, centroid: 0.5, pitchDelta: 0 };
    const speaking = run(2, { mood: "speaking", swirlSpeed: 1, signal }).values.at(-1)!;
    const listening = run(2, { mood: "listening", swirlSpeed: 1, signal }).values.at(-1)!;
    expect(listening.energy).toBeLessThan(speaking.energy * 0.4);
  });
});
