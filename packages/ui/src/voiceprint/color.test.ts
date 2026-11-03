import { describe, expect, it } from "vitest";
import { VOICE_HUES } from "../voice-hues";
import { blendFor, coolShift, parseCssColor, relativeLuminance } from "./color";

describe("parseCssColor", () => {
  it("reads the forms getComputedStyle returns", () => {
    expect(parseCssColor("rgb(124, 245, 230)")).toEqual([124 / 255, 245 / 255, 230 / 255]);
    expect(parseCssColor("rgba(0, 0, 0, 0.5)")).toEqual([0, 0, 0]);
    expect(parseCssColor("rgb(255 128 0)")).toEqual([1, 128 / 255, 0]);
    expect(parseCssColor("color(srgb 0.5 0.25 1)")).toEqual([0.5, 0.25, 1]);
    expect(parseCssColor("color(srgb 0.5 0.25 1 / 0.2)")).toEqual([0.5, 0.25, 1]);
    expect(parseCssColor("#fff")).toEqual([1, 1, 1]);
    expect(parseCssColor("#0A6B64")).toEqual([10 / 255, 107 / 255, 100 / 255]);
  });

  it("returns null for anything else", () => {
    expect(parseCssColor("")).toBeNull();
    expect(parseCssColor("var(--voice)")).toBeNull();
    expect(parseCssColor("rgb(1, 2)")).toBeNull();
  });
});

describe("blendFor", () => {
  it("glows every Night hue and layers every Day hue", () => {
    for (const hue of VOICE_HUES) {
      expect(blendFor(parseCssColor(hue.night)!)).toBe("light");
      expect(blendFor(parseCssColor(hue.day)!)).toBe("ink");
    }
    // The interviewer's silver, both themes.
    expect(blendFor(parseCssColor("#c8ccdc")!)).toBe("light");
    expect(blendFor(parseCssColor("#5f6478")!)).toBe("ink");
  });

  it("uses WCAG luminance", () => {
    expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1, 5);
    expect(relativeLuminance([0, 0, 0])).toBe(0);
  });
});

describe("coolShift", () => {
  it("leaves the hue alone at 0 and moves it towards blue when listening", () => {
    const amber = parseCssColor("#FFB86B")!;
    expect(coolShift(amber, 0)).toEqual(amber);
    const cooled = coolShift(amber, 1);
    expect(cooled[2]).toBeGreaterThan(amber[2]);
    expect(cooled[0]).toBeLessThan(amber[0]);
    // Never more than 45% of the way: it stays the applicant's colour.
    expect(cooled[0]).toBeGreaterThan(amber[0] - (amber[0] - 0.78) * 0.46);
  });
});
