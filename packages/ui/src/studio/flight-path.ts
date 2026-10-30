// Geometry of the story-capture flight (spec §6.7): the ignited phrase condenses into a story
// card and flies along a curved path into the shelf. The path is a quadratic Bézier from the
// phrase's centre to the shelf slot's centre, bowed upwards, and the box's size moves from the
// phrase's to the card's. The progress `t` comes from the drift spring, so the flight inherits
// its feel (and stays exact at t = 1, where the card meets its slot).

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const centreOf = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/** The point at `t` on the quadratic Bézier p0 → p2 pulled towards p1. */
export function quadraticPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

export interface ControlPointOptions {
  /** How far the curve bows, as a share of the distance travelled. */
  bow?: number;
  minBow?: number;
  maxBow?: number;
  /** Keep the control point inside this box (the viewport), so the card never leaves the screen. */
  bounds?: Box;
}

/**
 * The control point that bends a flight from `from` to `to`: the midpoint pushed out along the
 * perpendicular by `bow × distance` (clamped), on the upward side, so the card arcs over the
 * content between rather than sliding across it. A vertical flight bows towards the left.
 */
export function flightControlPoint(
  from: Point,
  to: Point,
  { bow = 0.3, minBow = 48, maxBow = 220, bounds }: ControlPointOptions = {},
): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (distance === 0) return mid;
  // Unit perpendicular; pick the side that points up the screen (negative y).
  let nx = -dy / distance;
  let ny = dx / distance;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const amount = Math.min(maxBow, Math.max(minBow, distance * bow));
  const control = { x: mid.x + nx * amount, y: mid.y + ny * amount };
  if (!bounds) return control;
  return {
    x: Math.min(bounds.x + bounds.width, Math.max(bounds.x, control.x)),
    y: Math.min(bounds.y + bounds.height, Math.max(bounds.y, control.y)),
  };
}

/**
 * The flying box at progress `t`: its centre on the curve, its size moving from the phrase's to
 * the card's. Size uses `t` clamped to 0..1 so a spring's overshoot never shrinks the card past
 * its slot; the position may overshoot very slightly, which reads as the card settling.
 */
export function flightBox(from: Box, to: Box, control: Point, t: number): Box {
  const centre = quadraticPoint(centreOf(from), control, centreOf(to), t);
  const s = clamp01(t);
  const width = lerp(from.width, to.width, s);
  const height = lerp(from.height, to.height, s);
  return { x: centre.x - width / 2, y: centre.y - height / 2, width, height };
}

/**
 * True when a box is on screen with some area, so it can serve as a flight target. A shelf below
 * the fold (phones) fails this, and the flight heads for the shelf button instead.
 */
export function isOnScreen(box: Box, viewport: { width: number; height: number }): boolean {
  return (
    box.width > 0 &&
    box.x < viewport.width &&
    box.x + box.width > 0 &&
    box.y < viewport.height &&
    box.y + Math.max(box.height, 1) > 0
  );
}

/** Opacity of the phrase (fading out) and the card (fading in) while the phrase condenses. */
export function condenseOpacity(t: number): { phrase: number; card: number } {
  return {
    phrase: 1 - clamp01(t / 0.35),
    card: clamp01((t - 0.15) / 0.4),
  };
}
