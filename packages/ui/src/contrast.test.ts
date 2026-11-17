import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "./theme-preference";
import { VOICE_HUES } from "./voice-hues";

// SPEC §2.1: every text pair meets WCAG AA in both themes. Hierarchy is opacity steps of one
// text colour, so every pair here is composited over its surface before it is measured.

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
  // rgb(244 241 234 / 0.64), the form tokens.css uses for every opacity step
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4] ?? 1)];
  return undefined;
}

function palette(source: string): Palette {
  const out: Palette = {};
  for (const [, name, value] of source.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
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

/** WCAG contrast of `fg` drawn on the opaque `bg`. A translucent `fg` is composited first. */
function contrast(fg: Rgba, bg: Rgba): number {
  if (bg[3] !== 1) throw new Error("contrast() needs an opaque background: composite it first");
  const [hi, lo] = [luminance(over(fg, bg)), luminance(bg)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const constants = palette(block(":root"));
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

/** The opaque surfaces text sits on: the page, a card, a sheet of paper. */
const SURFACES = ["space", "depth", "sheet"];

type Pair = [fg: string, bg: string, minimum: number, why: string];

const PAIRS: Pair[] = [
  ...[
    "text",
    "text-80",
    "text-soft",
    "text-label",
    "accent",
    "silver",
    "verified",
    "needs",
    "risk",
  ].flatMap((fg) => SURFACES.map((bg): Pair => [fg, bg, AA_TEXT, "text"])),
  ["sheet-text", "sheet", AA_TEXT, "long-form text on paper"],
  ["on-signal", "signal", AA_TEXT, "primary button text"],
  ["on-signal", "signal-hover", AA_TEXT, "primary button text, hovered"],
  ["on-signal", "risk", AA_TEXT, "danger button text"],
  ["on-signal", "text", AA_TEXT, "tooltip text (inverted)"],
  ["space", "text", AA_TEXT, "selected chip (inverted)"],
  ...SURFACES.flatMap((bg): Pair[] => [
    ["text-faint", bg, AA_NON_TEXT, "text of 24px and up, icons"],
    ["control-edge", bg, AA_NON_TEXT, "form control border"],
    ["text", bg, AA_NON_TEXT, "focus ring"],
    ["signal", bg, AA_NON_TEXT, "primary fill against the page"],
    ["record", bg, AA_NON_TEXT, "record button (fill and ring only)"],
  ]),
];

// Translucent fills (hover, selected, frost, fields): text is measured on the fill composited
// over each surface.
const FILLS = ["veil", "frost", "frost-hover", "field"];
const ON_FILLS = ["text", "text-soft"];

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

  it.each(FILLS.flatMap((fill) => ON_FILLS.flatMap((fg) => SURFACES.map((bg) => [fg, fill, bg]))))(
    "%s on --%s over %s ≥ 4.5",
    (fg, fill, bg) => {
      expect(contrast(get(fg!), over(get(fill!), get(bg!)))).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it.each(SURFACES)("a control border on a field over %s ≥ 3", (bg) => {
    const field = over(get("field"), get(bg));
    expect(contrast(get("control-edge"), field)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it.each(VOICE_HUES.map((hue) => [hue.name, hue]))(
    "text on the %s glow (over space, depth and the sheet) ≥ 4.5",
    (_name, hue) => {
      const glow = parseColour(hue[key])!;
      glow[3] = glowAlphas()[key];
      for (const bg of SURFACES) {
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

  it("--text-faint is below 4.5 somewhere in each theme, so it is never body text", () => {
    for (const theme of [day, night]) {
      const lowest = Math.min(...SURFACES.map((bg) => contrast(theme["text-faint"]!, theme[bg]!)));
      expect(lowest).toBeLessThan(AA_TEXT);
    }
  });

  it("--edge is decorative: below 3:1, so controls use --control-edge", () => {
    expect(contrast(day.edge!, day.depth!)).toBeLessThan(AA_NON_TEXT);
    expect(contrast(night.edge!, night.depth!)).toBeLessThan(AA_NON_TEXT);
  });
});

describe("tokens.css structure", () => {
  it("keeps the system-Night and explicit-Night palettes identical", () => {
    expect(nightMedia).toEqual(night);
  });

  it("defines every semantic colour in both themes", () => {
    const names = [
      "space",
      "depth",
      "sheet",
      "sheet-text",
      "field",
      "veil",
      "edge",
      "edge-strong",
      "control-edge",
      "text",
      "text-80",
      "text-soft",
      "text-label",
      "text-faint",
      "signal",
      "signal-hover",
      "on-signal",
      "accent",
      "frost",
      "frost-hover",
      "frost-solid",
      "record",
      "verified",
      "needs",
      "risk",
      "silver",
      "rail",
      "scrim",
    ];
    for (const name of names) {
      expect(day[name], `Day --${name}`).toBeDefined();
      expect(night[name], `Night --${name}`).toBeDefined();
    }
  });

  it("keeps the theme-color meta values equal to the casing in both themes (SPEC §6.1)", () => {
    expect(parseColour(THEME_COLORS.day)).toEqual(day.rail);
    expect(parseColour(THEME_COLORS.night)).toEqual(night.space);
    expect(parseColour(THEME_COLORS.night)).toEqual(night.rail);
  });

  it("matches SPEC §2.1 and §2.2 exactly", () => {
    const spec: Record<"day" | "night", Record<string, string>> = {
      night: {
        space: "#0B0A09",
        depth: "#151412",
        sheet: "#1C1A17",
        "sheet-text": "#ECE7DD",
        text: "#F4F1EA",
        signal: "#E2B36B",
        "signal-hover": "#E9C283",
        "on-signal": "#14110A",
        accent: "#E2B36B",
        "frost-solid": "#1B1A19",
        record: "#F0664E",
        verified: "#8CCBA0",
        needs: "#A9BEE0",
        risk: "#F09080",
        silver: "#C9C5BC",
      },
      day: {
        space: "#ECE9E2",
        depth: "#F7F5F0",
        sheet: "#F7F5F0",
        field: "#FCFBF8",
        text: "#141414",
        signal: "#141414",
        "on-signal": "#F7F5F0",
        accent: "#85590F",
        "frost-solid": "#EFEDE7",
        record: "#C8452F",
        verified: "#2A6B45",
        needs: "#34588F",
        risk: "#A8382A",
        silver: "#5E5C57",
      },
    };
    for (const [name, value] of Object.entries(spec.night)) {
      expect(night[name], name).toEqual(parseColour(value));
    }
    for (const [name, value] of Object.entries(spec.day)) {
      expect(day[name], name).toEqual(parseColour(value));
    }
    const fg = (alpha: number): Rgba => [244, 241, 234, alpha];
    const ink = (alpha: number): Rgba => [20, 20, 20, alpha];
    expect(night["text-80"]).toEqual(fg(0.8));
    expect(night["text-soft"]).toEqual(fg(0.64));
    expect(night["text-label"]).toEqual(fg(0.6));
    expect(night["text-faint"]).toEqual(fg(0.48));
    expect(night["control-edge"]).toEqual(fg(0.4));
    expect(night.edge).toEqual(fg(0.12));
    expect(night["edge-strong"]).toEqual(fg(0.2));
    expect(night.veil).toEqual(fg(0.04));
    expect(night.frost).toEqual(fg(0.07));
    expect(day["text-80"]).toEqual(ink(0.8));
    expect(day["text-soft"]).toEqual(ink(0.66));
    expect(day["text-faint"]).toEqual(ink(0.5));
    expect(day["control-edge"]).toEqual(ink(0.5));
    expect(day.edge).toEqual(ink(0.1));
    expect(day["edge-strong"]).toEqual(ink(0.18));
    expect(day.frost).toEqual(ink(0.05));
  });

  it("keeps the material constants equal to the themes built from them", () => {
    const same: [constant: string, theme: Palette, name: string][] = [
      ["bg", night, "space"],
      ["fg", night, "text"],
      ["fg-80", night, "text-80"],
      ["fg-64", night, "text-soft"],
      ["fg-60", night, "text-label"],
      ["fg-48", night, "text-faint"],
      ["fg-40", night, "control-edge"],
      ["line", night, "edge"],
      ["line-strong", night, "edge-strong"],
      ["surface-1", night, "veil"],
      ["surface-2", night, "frost"],
      ["brass", night, "accent"],
      ["brass-hover", night, "signal-hover"],
      ["on-brass", night, "on-signal"],
      ["sheet-night", night, "sheet"],
      ["text-night", night, "sheet-text"],
      ["paper", day, "depth"],
      ["desk", day, "space"],
      ["paper-raise", day, "field"],
      ["ink", day, "text"],
      ["ink-80", day, "text-80"],
      ["ink-66", day, "text-soft"],
      ["ink-50", day, "text-faint"],
      ["rule", day, "edge"],
      ["rule-strong", day, "edge-strong"],
      ["brass-ink", day, "accent"],
    ];
    for (const [constant, theme, name] of same) {
      expect(constants[constant], `--${constant}`).toBeDefined();
      expect(constants[constant], `--${constant} = --${name}`).toEqual(theme[name]);
    }
  });

  it("keeps the default --voice hue equal to the first of the 12", () => {
    expect(css).toContain(`--voice-night: ${VOICE_HUES[0]!.night.toLowerCase()};`);
    expect(css).toContain(`--voice-day: ${VOICE_HUES[0]!.day.toLowerCase()};`);
  });
});
