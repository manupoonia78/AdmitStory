// The renderer's colour comes from CSS: the host element's `color` is var(--voice) or
// var(--silver), already resolved for the theme it sits in and the applicant's chosen hue. These
// helpers turn the computed value into numbers for the shader. Pure.

export type Rgb = readonly [number, number, number];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function toRgb([r, g, b]: number[]): Rgb | null {
  if (r === undefined || g === undefined || b === undefined) return null;
  if (![r, g, b].every(Number.isFinite)) return null;
  return [clamp01(r), clamp01(g), clamp01(b)];
}

/**
 * Parses a computed CSS colour: rgb()/rgba() (comma or space syntax), color(srgb …) as
 * returned for color-mix() results, and #rgb/#rrggbb. Channels come back as 0..1; null when
 * the value isn't one of those.
 */
export function parseCssColor(value: string): Rgb | null {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    const channel = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
    return [channel(0), channel(2), channel(4)];
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(text)?.[1];
  if (rgb) {
    const parts = rgb
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3);
    if (parts.length < 3) return null;
    const channels = parts.map((part) =>
      part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part) / 255,
    );
    return toRgb(channels);
  }
  const srgb = /^color\(srgb\s+([^)]+)\)$/.exec(text)?.[1];
  if (srgb) {
    const channels = srgb
      .split(/[\s/]+/)
      .slice(0, 3)
      .map(parseFloat);
    return toRgb(channels);
  }
  return null;
}

/** WCAG relative luminance of an sRGB colour. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * Night hues are light and glow additively on --space; Day hues are the darker variants and
 * would wash out to white if added onto a light page, so they are layered like ink instead.
 */
export function blendFor(color: Rgb): "light" | "ink" {
  return relativeLuminance(color) > 0.3 ? "light" : "ink";
}

/** The "listening" tint: a cool, pale blue in Night and a deep cool blue in Day. */
const COOL_LIGHT: Rgb = [0.78, 0.86, 1];
const COOL_INK: Rgb = [0.2, 0.27, 0.5];

/** The hue moved `amount` (0..1) of the way towards the cool tint, at most 45%. */
export function coolShift(color: Rgb, amount: number): Rgb {
  const tint = blendFor(color) === "light" ? COOL_LIGHT : COOL_INK;
  const t = clamp01(amount) * 0.45;
  const mix = (from: number, to: number) => from + (to - from) * t;
  return [mix(color[0], tint[0]), mix(color[1], tint[1]), mix(color[2], tint[2])];
}
