import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "./theme-preference";
import { VOICE_HUES } from "./voice-hues";

// Spec §6.3: "Every text pair meets WCAG AA in both themes (a contrast test runs in CI)".

type Rgba = [number, number, number, number];
type Palette = Record<string, Rgba>;

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`tokens.css has no "${selector}" block`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

function parseColour(value: string): Rgba | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  return undefined;
}

function palette(source: string): Palette {
  const out: Palette = {};
  for (const [, name, value] of source.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    const colour = name && value ? parseColour(value.trim()) : undefined;
    if (name && colour) out[name] = colour;
  }
  return out;
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i]! * a + bottom[i]! * (1 - a)).concat(1) as Rgba;
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const day = palette(block('[data-theme="day"]'));
const nightMedia = palette(block(':root:not([data-theme="day"])'));
const night = palette(block('[data-theme="night"]'));

/** The --voice-glow mix percentages, read from tokens.css: [day, night]. */
function glowAlphas(): { day: number; night: number } {
  const match =
    /--voice-glow:\s*light-dark\(\s*color-mix\(in srgb, var\(--voice-day\) (\d+)%, transparent\),\s*color-mix\(in srgb, var\(--voice-night\) (\d+)%, transparent\)\s*\)/.exec(
      css,
    );
  if (!match) throw new Error("tokens.css --voice-glow has an unexpected shape");
  return { day: Number(match[1]) / 100, night: Number(match[2]) / 100 };
}

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

type Pair = [fg: string, bg: string, minimum: number, why: string];

const PAIRS: Pair[] = [
  ...["text", "text-soft", "signal", "silver", "verified", "needs", "risk"].flatMap((fg) =>
    ["space", "depth"].map((bg): Pair => [fg, bg, AA_TEXT, "text"]),
  ),
  ["on-signal", "signal", AA_TEXT, "primary button text"],
  ["on-signal", "risk", AA_TEXT, "danger button text"],
  ["on-signal", "text", AA_TEXT, "tooltip text (inverted)"],
  ...["space", "depth"].flatMap((bg): Pair[] => [
    ["control-edge", bg, AA_NON_TEXT, "form control border"],
    ["signal", bg, AA_NON_TEXT, "focus ring"],
    ["record", bg, AA_NON_TEXT, "record button (fill and ring only)"],
  ]),
];

// Hover and selected planes are translucent: measured composited over each surface.
const ON_VEIL = ["text", "text-soft", "signal"];

describe.each([
  ["Day", day, "day" as const],
  ["Night", night, "night" as const],
])("%s tokens", (_theme, colours, key) => {
  const get = (name: string): Rgba => {
    const colour = colours[name];
    if (!colour) throw new Error(`missing --${name}`);
    return colour;
  };

  it.each(PAIRS)("%s on %s ≥ %s (%s)", (fg, bg, minimum) => {
    expect(contrast(get(fg), get(bg))).toBeGreaterThanOrEqual(minimum);
  });

  it.each(ON_VEIL.flatMap((fg) => ["space", "depth"].map((bg) => [fg, bg])))(
    "%s on --veil over %s ≥ 4.5",
    (fg, bg) => {
      expect(contrast(get(fg), over(get("veil"), get(bg)))).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it.each(VOICE_HUES.map((hue) => [hue.name, hue]))(
    "text on the %s glow (over space and depth) ≥ 4.5",
    (_name, hue) => {
      const glow = parseColour(hue[key])!;
      glow[3] = glowAlphas()[key];
      for (const bg of ["space", "depth"]) {
        expect(contrast(get("text"), over(glow, get(bg)))).toBeGreaterThanOrEqual(AA_TEXT);
      }
    },
  );
});

describe("restricted uses", () => {
  // These fail as text, which is why tokens.css limits them; if a value changes so that
  // they pass, the restriction (and its comment) can go.
  it("Day --record is below 4.5 on --space, so --record is never text", () => {
    expect(contrast(day.record!, day.space!)).toBeLessThan(AA_TEXT);
  });

  it("Day status colours are below 4.5 on --veil, so they never sit on it", () => {
    const veiled = over(day.veil!, day.space!);
    expect(contrast(day.verified!, veiled)).toBeLessThan(AA_TEXT);
  });

  it("--edge is decorative: below 3:1, so controls use --control-edge", () => {
    expect(contrast(day.edge!, day.depth!)).toBeLessThan(AA_NON_TEXT);
    expect(contrast(over(night.edge!, night.depth!), night.depth!)).toBeLessThan(AA_NON_TEXT);
  });
});

describe("tokens.css structure", () => {
  it("keeps the system-Night and explicit-Night palettes identical", () => {
    expect(nightMedia).toEqual(night);
  });

  it("defines every spec §6.3 colour, plus the additions, in both themes", () => {
    const names = [
      "space",
      "depth",
      "veil",
      "edge",
      "text",
      "text-soft",
      "signal",
      "record",
      "verified",
      "needs",
      "risk",
      "on-signal",
      "control-edge",
      "silver",
      "scrim",
    ];
    for (const name of names) {
      expect(day[name], `Day --${name}`).toBeDefined();
      expect(night[name], `Night --${name}`).toBeDefined();
    }
  });

  it("keeps the theme-color meta values equal to --space in each theme", () => {
    expect(parseColour(THEME_COLORS.day)).toEqual(day.space);
    expect(parseColour(THEME_COLORS.night)).toEqual(night.space);
  });

  it("matches the spec §6.3 values exactly", () => {
    const spec: Record<"day" | "night", Record<string, string>> = {
      night: {
        space: "#070A1F",
        depth: "#0E1433",
        text: "#EEF0FF",
        "text-soft": "#9AA2CC",
        signal: "#9DB1FF",
        record: "#FF5A6E",
        verified: "#5BE3A1",
        needs: "#FFC46B",
        risk: "#FF7A85",
      },
      day: {
        space: "#F4F5FB",
        depth: "#FFFFFF",
        edge: "#DCE0EE",
        text: "#141833",
        "text-soft": "#5B6285",
        signal: "#2E3FD1",
        record: "#D92D45",
        verified: "#13804F",
        needs: "#A65A00",
        risk: "#C42B3A",
      },
    };
    for (const [name, value] of Object.entries(spec.night)) {
      expect(night[name], name).toEqual(parseColour(value));
    }
    for (const [name, value] of Object.entries(spec.day)) {
      expect(day[name], name).toEqual(parseColour(value));
    }
    expect(night.veil).toEqual([140, 160, 255, 0.08]);
    expect(night.edge).toEqual([170, 185, 255, 0.14]);
    expect(day.veil).toEqual([20, 30, 90, 0.05]);
  });

  it("keeps the default --voice hue equal to the first of the 12", () => {
    expect(css).toContain(`--voice-night: ${VOICE_HUES[0]!.night.toLowerCase()};`);
    expect(css).toContain(`--voice-day: ${VOICE_HUES[0]!.day.toLowerCase()};`);
  });
});
