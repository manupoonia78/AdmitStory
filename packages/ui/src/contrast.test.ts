import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "./theme-preference";

// Spec §6.2: "all text pairs meet WCAG AA (verify with a contrast test in CI)".

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

const light = palette(block(":root"));
const darkMedia = palette(block(':root:not([data-theme="light"])'));
const dark = palette(block(':root[data-theme="dark"]'));

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

// [foreground, background, minimum, why]
const PAIRS: [string, string, number, string][] = [
  ...["graphite", "slate", "ink", "verified", "needs", "risk"].flatMap((fg) =>
    ["paper", "mist"].map((bg): [string, string, number, string] => [fg, bg, AA_TEXT, "text"]),
  ),
  ...["graphite", "slate", "ink"].map((fg): [string, string, number, string] => [
    fg,
    "ink-soft",
    AA_TEXT,
    "text on hover/selected",
  ]),
  ["paper", "ink", AA_TEXT, "primary button text"],
  ["paper", "risk", AA_TEXT, "danger button text"],
  ["slate", "paper", AA_NON_TEXT, "form control border"],
  ["slate", "mist", AA_NON_TEXT, "form control border"],
  ["ink", "paper", AA_NON_TEXT, "focus ring"],
  ["ink", "mist", AA_NON_TEXT, "focus ring"],
  ["record", "paper", AA_NON_TEXT, "record button"],
  ["record", "mist", AA_NON_TEXT, "record button"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s mode tokens", (_mode, colours) => {
  const get = (name: string): Rgba => {
    const colour = colours[name];
    if (!colour) throw new Error(`missing --${name}`);
    return colour;
  };

  it.each(PAIRS)("%s on %s ≥ %s (%s)", (fg, bg, minimum) => {
    expect(contrast(get(fg), get(bg))).toBeGreaterThanOrEqual(minimum);
  });

  it("graphite on the highlighter (composited over paper) ≥ 4.5", () => {
    const highlighted = over(get("highlighter"), get("paper"));
    expect(contrast(get("graphite"), highlighted)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("tokens.css structure", () => {
  it("keeps the system-dark and explicit-dark palettes identical", () => {
    expect(darkMedia).toEqual(dark);
  });

  it("defines every spec §6.2 colour in both modes", () => {
    const names = [
      "paper",
      "mist",
      "line",
      "graphite",
      "slate",
      "ink",
      "ink-soft",
      "highlighter",
      "record",
      "verified",
      "needs",
      "risk",
    ];
    for (const name of names) {
      expect(light[name], `light --${name}`).toBeDefined();
      expect(dark[name], `dark --${name}`).toBeDefined();
    }
  });

  it("keeps the theme-color meta values equal to --mist in each mode", () => {
    expect(parseColour(THEME_COLORS.light)).toEqual(light.mist);
    expect(parseColour(THEME_COLORS.dark)).toEqual(dark.mist);
  });

  it("matches the spec §6.2 values exactly", () => {
    expect(light.ink).toEqual([0x1e, 0x2b, 0x6f, 1]);
    expect(dark.ink).toEqual([0x8e, 0xa2, 0xff, 1]);
    expect(light.highlighter).toEqual([255, 224, 102, 0.6]);
    expect(dark.highlighter).toEqual([232, 197, 71, 0.28]);
  });
});
