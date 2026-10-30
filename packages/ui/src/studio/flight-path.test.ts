import { describe, expect, it } from "vitest";
import {
  centreOf,
  condenseOpacity,
  flightBox,
  flightControlPoint,
  isOnScreen,
  quadraticPoint,
  type Box,
} from "./flight-path";

const PHRASE: Box = { x: 200, y: 600, width: 480, height: 56 };
const SLOT: Box = { x: 1000, y: 120, width: 280, height: 96 };

/** Signed distance of p from the line a→b; negative means p is on the upper side for a→b going right. */
function sideOfLine(a: { x: number; y: number }, b: { x: number; y: number }, p: typeof a) {
  return ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
}

describe("quadraticPoint", () => {
  it("starts at p0, ends at p2 and passes the midpoint of the control hull at t = 0.5", () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 50, y: -100 };
    const p2 = { x: 100, y: 0 };
    expect(quadraticPoint(p0, p1, p2, 0)).toEqual(p0);
    expect(quadraticPoint(p0, p1, p2, 1)).toEqual(p2);
    expect(quadraticPoint(p0, p1, p2, 0.5)).toEqual({ x: 50, y: -50 });
  });
});

describe("flightControlPoint", () => {
  it("bows a horizontal flight upwards by the clamped share of the distance", () => {
    const control = flightControlPoint({ x: 0, y: 300 }, { x: 400, y: 300 }, { bow: 0.25 });
    expect(control).toEqual({ x: 200, y: 200 });
  });

  it("bows upwards whichever way the card travels", () => {
    expect(flightControlPoint({ x: 400, y: 300 }, { x: 0, y: 300 }).y).toBeLessThan(300);
    const from = centreOf(PHRASE);
    const to = centreOf(SLOT);
    const control = flightControlPoint(from, to);
    // Above the straight line from phrase to slot.
    expect(control.y).toBeLessThan((from.y + to.y) / 2);
  });

  it("clamps the bow for very short and very long flights", () => {
    const short = flightControlPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, { minBow: 48 });
    expect(short.y).toBe(-48);
    const long = flightControlPoint({ x: 0, y: 0 }, { x: 5000, y: 0 }, { maxBow: 220 });
    expect(long.y).toBe(-220);
  });

  it("stays inside the bounds it is given", () => {
    const control = flightControlPoint(
      { x: 100, y: 40 },
      { x: 900, y: 40 },
      {
        bounds: { x: 0, y: 0, width: 1000, height: 800 },
      },
    );
    expect(control.y).toBe(0);
  });

  it("returns the point itself when there is nowhere to go", () => {
    expect(flightControlPoint({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });
});

describe("flightBox", () => {
  const control = flightControlPoint(centreOf(PHRASE), centreOf(SLOT));

  it("is the phrase at t = 0 and exactly the slot at t = 1", () => {
    expect(flightBox(PHRASE, SLOT, control, 0)).toEqual(PHRASE);
    const end = flightBox(PHRASE, SLOT, control, 1);
    expect(end.x).toBeCloseTo(SLOT.x, 6);
    expect(end.y).toBeCloseTo(SLOT.y, 6);
    expect(end.width).toBe(SLOT.width);
    expect(end.height).toBe(SLOT.height);
  });

  it("travels a curve: mid-flight it is above the straight line, not on it", () => {
    const from = centreOf(PHRASE);
    const to = centreOf(SLOT);
    for (const t of [0.25, 0.5, 0.75]) {
      const centre = centreOf(flightBox(PHRASE, SLOT, control, t));
      expect(sideOfLine(from, to, centre)).toBeLessThan(-10);
    }
  });

  it("never shrinks past the card when the spring overshoots", () => {
    const over = flightBox(PHRASE, SLOT, control, 1.02);
    expect(over.width).toBe(SLOT.width);
    expect(over.height).toBe(SLOT.height);
  });
});

describe("isOnScreen", () => {
  const viewport = { width: 390, height: 844 };

  it("accepts a box with area inside the viewport", () => {
    expect(isOnScreen({ x: 16, y: 100, width: 300, height: 80 }, viewport)).toBe(true);
  });

  it("accepts a slot that has not grown yet but has a width", () => {
    expect(isOnScreen({ x: 16, y: 100, width: 300, height: 0 }, viewport)).toBe(true);
  });

  it("rejects boxes below the fold, off to the side or with no width", () => {
    expect(isOnScreen({ x: 16, y: 900, width: 300, height: 80 }, viewport)).toBe(false);
    expect(isOnScreen({ x: 400, y: 100, width: 300, height: 80 }, viewport)).toBe(false);
    expect(isOnScreen({ x: 16, y: 100, width: 0, height: 80 }, viewport)).toBe(false);
  });
});

describe("condenseOpacity", () => {
  it("crossfades phrase into card early in the flight", () => {
    expect(condenseOpacity(0)).toEqual({ phrase: 1, card: 0 });
    expect(condenseOpacity(1)).toEqual({ phrase: 0, card: 1 });
    const mid = condenseOpacity(0.3);
    expect(mid.phrase).toBeGreaterThan(0);
    expect(mid.card).toBeGreaterThan(0);
  });
});
