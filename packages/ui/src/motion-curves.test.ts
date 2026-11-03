import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOTION_TOKENS, cssSpring } from "./motion";
import { SETTLE_SECONDS, springEase, springSamples } from "./motion-curves";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

/** The 41 values of the token's CSS linear() easing. */
const cssPoints = (token: (typeof MOTION_TOKENS)[number]) =>
  cssSpring(token).easing.slice("linear(".length, -1).split(", ").map(Number);

describe("springEase", () => {
  it.each(MOTION_TOKENS)("traces the %s CSS spring within 0.002 at its 41 points", (token) => {
    const ease = springEase(token);
    const last = springSamples(token).length - 1;
    const points = cssPoints(token);
    expect(points).toHaveLength(41);
    points.forEach((point, i) => {
      // cssSpring reads the sample nearest each 1/40 of the duration; ask the ease for the same
      // instant, so the only difference left is linear() rounding to three decimals.
      const t = i === 40 ? 1 : Math.round((i / 40) * last) / last;
      expect(Math.abs(ease(t) - point)).toBeLessThanOrEqual(0.002);
    });
  });

  it.each(MOTION_TOKENS)("starts at exactly 0 and ends at exactly 1 (%s)", (token) => {
    const ease = springEase(token);
    expect(ease(0)).toBe(0);
    expect(ease(-0.5)).toBe(0);
    expect(ease(Number.NaN)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(1.5)).toBe(1);
  });

  it("overshoots for snap and glide, and never for settle", () => {
    const peak = (token: (typeof MOTION_TOKENS)[number]) => {
      const ease = springEase(token);
      let max = 0;
      for (let i = 0; i <= 1000; i += 1) max = Math.max(max, ease(i / 1000));
      return max;
    };
    expect(peak("snap")).toBeGreaterThan(1);
    expect(peak("glide")).toBeGreaterThan(1);
    expect(peak("settle")).toBeLessThanOrEqual(1.0005);
  });

  it("is continuous between samples", () => {
    const ease = springEase("drift");
    for (let i = 0; i < 1000; i += 1) {
      expect(Math.abs(ease((i + 1) / 1000) - ease(i / 1000))).toBeLessThan(0.01);
    }
  });
});

describe("SETTLE_SECONDS", () => {
  it("equals the tokens.css durations", () => {
    expect(SETTLE_SECONDS).toEqual({ snap: 0.35, glide: 0.48, drift: 0.68, settle: 1.12 });
    for (const token of MOTION_TOKENS) {
      expect(css).toContain(
        `--spring-${token}-duration: ${Math.round(SETTLE_SECONDS[token] * 1000)}ms;`,
      );
      expect(SETTLE_SECONDS[token] * 1000).toBeCloseTo(cssSpring(token).durationMs, 6);
    }
  });
});

describe("motion-curves stays free of Motion", () => {
  it("does not import motion/react", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./motion-curves.ts", import.meta.url)),
      "utf8",
    );
    const springs = readFileSync(fileURLToPath(new URL("./springs.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/from "motion/);
    expect(springs).not.toMatch(/from "motion/);
  });
});
