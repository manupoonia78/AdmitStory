// The Voiceline's shape (SPEC §3.4): one function for the server-rendered poster path and the
// canvas that takes over from it, so the hand-over can't be seen. Pure maths, no DOM.
//
//   y(x, t) = E(x) · [0.55·sin(2π(px/140 − 0.6t)) + 0.30·sin(2π(px/52 + 1.1t) + 1.7)
//                     + 0.15·n(px/18 + 2.4t)]
//
// x runs 0–1 across the hero, px is x times a width in pixels, n is value noise, and E keeps the
// line flat where the headline sits and tapers it at the right edge. The result is −1 to 1; the
// caller multiplies by the speaking level and the form's amplitude.

export interface LineForm {
  /** The width the poster is drawn for. The canvas uses the real width once it is live. */
  ref: number;
  /** Where the line leaves flat and reaches full height, as fractions of the width. */
  rise: readonly [number, number];
  /** Where the stroke leaves neutral and reaches brass. */
  tint: readonly [number, number];
  /** Peak height in CSS pixels at full level. */
  amp: number;
}

/** Laptops and up: flat and neutral under the copy, alive and brass across the right. */
export const LINE_LG: LineForm = { ref: 1440, rise: [0.5, 0.7], tint: [0.5, 0.68], amp: 34 };
/** Phones and tablets: the stage is the full width, so the line is alive across all of it. */
export const LINE_BASE: LineForm = { ref: 390, rise: [0.04, 0.2], tint: [0.02, 0.22], amp: 22 };

/** The line's box: this tall, centred on the horizon. */
export const LINE_HEIGHT = 96;
export const LINE_STROKE = 1.25;

/** The frozen frame the server draws: mid-sentence, at a moment chosen for its shape. */
export const POSTER = { t: 1.7, level: 0.86 } as const;

function smoothstep(from: number, to: number, x: number): number {
  const p = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return p * p * (3 - 2 * p);
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43_758.5453;
  return x - Math.floor(x);
}

/** 1-D value noise, −1 to 1, smooth between whole numbers. */
function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}

const TAU = Math.PI * 2;

/** The line's height at x (0–1), −1 to 1, for a hero `width` pixels wide at time `t` seconds. */
export function lineAt(x: number, width: number, t: number, form: LineForm): number {
  const envelope = smoothstep(form.rise[0], form.rise[1], x) * (1 - smoothstep(0.965, 1, x));
  if (envelope === 0) return 0;
  const px = x * width;
  return (
    envelope *
    (0.55 * Math.sin(TAU * (px / 140 - 0.6 * t)) +
      0.3 * Math.sin(TAU * (px / 52 + 1.1 * t) + 1.7) +
      0.15 * noise(px / 18 + 2.4 * t))
  );
}

/** How many segments draw the live part of a line `width` pixels wide: one every 4 px. */
export function lineSegments(width: number, form: LineForm): number {
  return Math.min(260, Math.max(48, Math.ceil(((1 - form.rise[0]) * width) / 4)));
}

/** The poster as an SVG path in a `form.ref` × LINE_HEIGHT box. */
export function posterPath(form: LineForm): string {
  const mid = LINE_HEIGHT / 2;
  const start = form.rise[0];
  const count = lineSegments(form.ref, form);
  let d = `M0 ${mid}H${(start * form.ref).toFixed(1)}`;
  for (let i = 1; i <= count; i += 1) {
    const x = start + ((1 - start) * i) / count;
    const y = mid + form.amp * POSTER.level * lineAt(x, form.ref, POSTER.t, form);
    d += `L${(x * form.ref).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
