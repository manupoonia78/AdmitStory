import { describe, expect, it } from "vitest";
import { READINGS } from "./fixtures.testing";
import { LENS_DIAL, arcPath, layoutLensDial, lensFraction, lensSummary } from "./lens-geometry";

describe("layoutLensDial", () => {
  const arcs = layoutLensDial(READINGS);

  it("cuts one dial into four quadrants, clockwise from twelve, with gaps between them", () => {
    expect(arcs.map((arc) => arc.lens)).toEqual([
      "academics",
      "self_awareness",
      "employability",
      "leadership",
    ]);
    arcs.forEach((arc, index) => {
      expect(arc.trackStart).toBe(index * 90 + LENS_DIAL.quadrantGap / 2);
      expect(arc.trackEnd).toBe((index + 1) * 90 - LENS_DIAL.quadrantGap / 2);
    });
  });

  it("fills each quadrant to its level", () => {
    expect(lensFraction("none")).toBe(0);
    expect(lensFraction("strong")).toBe(1);
    const employability = arcs[2]!;
    expect(employability.fillEnd).toBe(employability.trackEnd);
    const academics = arcs[0]!;
    expect(academics.fillEnd - academics.trackStart).toBeCloseTo((80 * 2) / 3);
  });

  it("builds an arc from its stories, by weight, with gaps between them", () => {
    const [heavy, light] = arcs[2]!.segments;
    expect(heavy!.storyId).toBe("S02");
    expect(heavy!.end - heavy!.start).toBeCloseTo(2 * (light!.end - light!.start));
    expect(light!.start - heavy!.end).toBeCloseTo(LENS_DIAL.segmentGap);
    expect(light!.end).toBeCloseTo(arcs[2]!.fillEnd);
  });

  it("draws a level with no stories listed as one plain segment, and none as nothing", () => {
    expect(arcs[1]!.segments).toEqual([
      { storyId: null, start: arcs[1]!.trackStart, end: arcs[1]!.fillEnd },
    ]);
    expect(layoutLensDial([])[0]!.segments).toEqual([]);
  });

  it("says each arc in words", () => {
    expect(lensSummary(arcs[3]!)).toBe("Leadership: developing, from 3 stories");
    expect(lensSummary(arcs[0]!)).toBe("Academics: developing, from 1 story");
    expect(lensSummary(arcs[1]!)).toBe("Self-awareness: thin, no stories listed");
    expect(lensSummary(layoutLensDial([])[0]!)).toBe("Academics: not shown yet");
  });

  it("draws clockwise arcs on the dial's circle", () => {
    expect(arcPath(0, 90)).toBe("M 100 22 A 78 78 0 0 1 178 100");
  });
});
