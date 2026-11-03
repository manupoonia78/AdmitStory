import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOTION_TOKENS, REDUCED_FADE, SPRINGS, cssSpring, spring } from "./motion";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

describe("motion tokens", () => {
  it("match spec §6.6 exactly", () => {
    expect(SPRINGS).toEqual({
      snap: { stiffness: 700, damping: 40, mass: 1 },
      glide: { stiffness: 380, damping: 34, mass: 1 },
      drift: { stiffness: 160, damping: 26, mass: 1.2 },
      settle: { stiffness: 90, damping: 20, mass: 1 },
    });
    expect(MOTION_TOKENS).toEqual(["snap", "glide", "drift", "settle"]);
  });

  it("build Motion spring transitions", () => {
    expect(spring("glide")).toEqual({ type: "spring", stiffness: 380, damping: 34, mass: 1 });
  });

  it("become a 120 ms linear fade under reduced motion", () => {
    expect(REDUCED_FADE).toEqual({ duration: 0.12, ease: "linear" });
  });
});

describe("CSS springs", () => {
  it("start at 0, end at 1, and slow down from snap to settle", () => {
    const durations = MOTION_TOKENS.map((token) => {
      const { easing, durationMs } = cssSpring(token);
      expect(easing.startsWith("linear(0, ")).toBe(true);
      expect(easing.endsWith(", 1)")).toBe(true);
      return durationMs;
    });
    expect([...durations].sort((a, b) => a - b)).toEqual(durations);
  });

  it("overshoot only for the underdamped springs", () => {
    const peak = (token: (typeof MOTION_TOKENS)[number]) =>
      Math.max(...cssSpring(token).easing.slice(7, -1).split(", ").map(Number));
    expect(peak("snap")).toBeGreaterThan(1);
    expect(peak("settle")).toBe(1);
  });

  it.each(MOTION_TOKENS)("tokens.css carries the generated %s curve", (token) => {
    const { easing, durationMs } = cssSpring(token);
    expect(css).toContain(`--spring-${token}: ${easing};`);
    expect(css).toContain(`--spring-${token}-duration: ${durationMs}ms;`);
  });

  it("tokens.css turns every spring into a 120 ms fade under reduced motion", () => {
    const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const reduced = css.slice(start, css.indexOf("}", css.indexOf("}", start) + 1));
    for (const token of MOTION_TOKENS) {
      expect(reduced).toContain(`--spring-${token}: linear;`);
      expect(reduced).toContain(`--spring-${token}-duration: 120ms;`);
    }
  });
});
