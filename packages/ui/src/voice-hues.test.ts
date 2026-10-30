import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VOICE_HUES, voiceHueAt, voiceHueStyle } from "./voice-hues";

// Spec §6.3: the 12 hues are pre-tuned for contrast against both themes. Duet-stage captions are
// set in the hue, so each variant must reach text contrast on its theme's --space and --depth.

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

function hex(value: string): [number, number, number] {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(value: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hex(value);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Hue angle in degrees (HSL). */
function hueAngle(value: string): number {
  const [r, g, b] = hex(value).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const hueDistance = (a: string, b: string) => {
  const d = Math.abs(hueAngle(a) - hueAngle(b));
  return Math.min(d, 360 - d);
};

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A colour token for a theme, read from tokens.css so the test follows the tokens. */
function token(selector: string, name: string): string {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i").exec(body);
  if (!match?.[1]) throw new Error(`no --${name} in ${selector}`);
  return match[1];
}

/** --space and --depth for a theme. */
const surfaces = (selector: string) => ["space", "depth"].map((name) => token(selector, name));

const NIGHT = surfaces('[data-theme="night"]');
const DAY = surfaces('[data-theme="day"]');

describe("voice hues", () => {
  it("has exactly 12, with unique ids and names", () => {
    expect(VOICE_HUES).toHaveLength(12);
    expect(new Set(VOICE_HUES.map((h) => h.id)).size).toBe(12);
    expect(new Set(VOICE_HUES.map((h) => h.name)).size).toBe(12);
  });

  it("includes the spec §6.3 examples as Night variants", () => {
    const night = VOICE_HUES.map((h) => h.night.toUpperCase());
    expect(night).toEqual(expect.arrayContaining(["#7CF5E6", "#FFB86B", "#C59BFF"]));
  });

  it.each(VOICE_HUES.map((h) => [h.name, h]))(
    "%s is text-grade on Night and Day surfaces",
    (_name, hue) => {
      for (const surface of NIGHT) expect(contrast(hue.night, surface)).toBeGreaterThanOrEqual(4.5);
      for (const surface of DAY) expect(contrast(hue.day, surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("keeps clear of --signal's hue, so the applicant's colour never reads as interactive", () => {
    const night = token('[data-theme="night"]', "signal");
    const day = token('[data-theme="day"]', "signal");
    for (const hue of VOICE_HUES) {
      expect(hueDistance(hue.night, night), hue.name).toBeGreaterThanOrEqual(20);
      expect(hueDistance(hue.day, day), hue.name).toBeGreaterThanOrEqual(20);
    }
  });

  it("makes each Day variant darker than its Night variant", () => {
    for (const hue of VOICE_HUES) expect(luminance(hue.day)).toBeLessThan(luminance(hue.night));
  });

  it("wraps any index onto the 12 hues", () => {
    expect(voiceHueAt(0)).toBe(VOICE_HUES[0]);
    expect(voiceHueAt(13)).toBe(VOICE_HUES[1]);
    expect(voiceHueAt(-1)).toBe(VOICE_HUES[11]);
    expect(voiceHueAt(Number.NaN)).toBe(VOICE_HUES[0]);
  });

  it("sets both theme variants as custom properties", () => {
    expect(voiceHueStyle(2)).toEqual({ "--voice-night": "#C59BFF", "--voice-day": "#6A3DC4" });
  });
});
