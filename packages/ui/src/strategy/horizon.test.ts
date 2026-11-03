import { describe, expect, it } from "vitest";
import { NOW, SCHOOLS, TZ } from "./fixtures.testing";
import {
  horizonModel,
  laneSummary,
  moveIndex,
  selectionAnnouncement,
  toggleSelection,
  visualOrder,
} from "./horizon";

describe("horizonModel", () => {
  const model = horizonModel(SCHOOLS, { now: NOW, timeZone: TZ });

  it("places every round on one axis, in deadline order, with today between them", () => {
    const [northfield, harbor] = model.lanes;
    expect(northfield!.marks.map((mark) => mark.short)).toEqual(["R1", "R2"]);
    expect(harbor!.marks[0]!.at).toBeLessThan(model.today);
    expect(northfield!.marks[1]!.at).toBeGreaterThan(model.today);
    for (const mark of [...northfield!.marks, ...harbor!.marks]) {
      expect(mark.at).toBeGreaterThanOrEqual(0);
      expect(mark.at).toBeLessThanOrEqual(1);
    }
  });

  it("says each date in the applicant's time zone, with the days left", () => {
    const r2 = model.lanes[0]!.marks[1]!;
    // 23:59 in New York on 6 Jan is 10:29 on 7 Jan in Kolkata.
    expect(r2.deadline).toMatch(/7 Jan 2027, 10:29/);
    expect(r2.daysLeftText).toBe("68 days left");
    expect(r2.planned).toBe(true);
    expect(model.lanes[0]!.marks[0]!.daysLeftText).toBe("Passed");
    expect(model.lanes[0]!.marks[0]!.past).toBe(true);
  });

  it("shows no dates for a school without a published pack", () => {
    const westbridge = model.lanes[2]!;
    expect(westbridge.marks).toEqual([]);
    expect(westbridge.verified).toBeNull();
    expect(laneSummary(westbridge)).toBe("Westbridge, pack coming soon");
  });

  it("names a lane with all of its rounds", () => {
    expect(laneSummary(model.lanes[0]!)).toMatch(
      /^Northfield\. Round 1, .*Passed\. Round 2, .*68 days left, your planned round$/,
    );
    expect(model.lanes[0]!.verified).toBe("Verified 12 Sep 2026");
  });
});

describe("selection", () => {
  it("toggles a school in and out", () => {
    expect(toggleSelection([], "a")).toEqual(["a"]);
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("puts compared schools first only once two are chosen", () => {
    expect(visualOrder(["a", "b", "c"], ["c"])).toEqual(["a", "b", "c"]);
    expect(visualOrder(["a", "b", "c"], ["c", "b"])).toEqual(["b", "c", "a"]);
  });

  it("moves with arrows, Home and End, and stops at the ends", () => {
    expect(moveIndex("ArrowDown", 0, 3)).toBe(1);
    expect(moveIndex("ArrowRight", 2, 3)).toBe(2);
    expect(moveIndex("ArrowUp", 0, 3)).toBe(0);
    expect(moveIndex("Home", 2, 3)).toBe(0);
    expect(moveIndex("End", 0, 3)).toBe(2);
    expect(moveIndex("a", 0, 3)).toBeNull();
  });

  it("announces what is being compared", () => {
    expect(selectionAnnouncement(["Northfield"])).toBe(
      "Northfield selected. Select one more to compare.",
    );
    expect(selectionAnnouncement(["Northfield", "Harbor", "Westbridge"])).toBe(
      "Comparing Northfield, Harbor and Westbridge.",
    );
  });
});
