// @vitest-environment jsdom
import "../../test/dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEADLINES, NOW, TZ } from "./fixtures.testing";
import { HonestFlagList } from "./honest-flags";
import { RoundPlanner, plannerModel } from "./round-planner";
import type { PlannedApplication } from "./types";

const PLAN: PlannedApplication[] = [
  {
    schoolId: "harbor",
    schoolName: "Harbor",
    roundLabel: "Round 2",
    deadline: "2027-01-09T12:00:00Z",
    startBy: "2026-11-20T00:00:00Z",
    effort: "about 3 weeks for 2 essays",
    order: 2,
    citation: DEADLINES,
  },
  {
    schoolId: "northfield",
    schoolName: "Northfield",
    roundLabel: "Round 2",
    deadline: "2027-01-06T23:59:00-05:00",
    startBy: "2026-11-10T00:00:00Z",
    effort: "about 4 weeks for 3 essays",
    order: 1,
    note: "Round 2 is the school's largest round.",
    citation: DEADLINES,
  },
  {
    schoolId: "eastport",
    schoolName: "Eastport",
    roundLabel: "Round 3",
    deadline: "2027-04-01T12:00:00Z",
    startBy: "2027-02-15T00:00:00Z",
    effort: "about 2 weeks for 1 essay",
    order: 3,
    citation: DEADLINES,
  },
];

describe("plannerModel", () => {
  it("makes a lane per round and a bar from start to deadline", () => {
    const model = plannerModel(PLAN, { now: NOW, timeZone: TZ });
    expect(model.lanes.map((lane) => lane.round)).toEqual(["Round 2", "Round 3"]);
    const [first, second] = model.lanes[0]!.bars;
    expect(first!.item.schoolName).toBe("Northfield");
    expect(second!.item.schoolName).toBe("Harbor");
    expect(first!.end).toBeGreaterThan(first!.start);
    expect(first!.effortText).toBe("Start by 10 Nov, about 4 weeks for 3 essays");
    expect(first!.dueText).toBe("Due 7 Jan 2027, 10:29 GMT+5:30");
  });
});

describe("RoundPlanner", () => {
  it("states the order, the effort and the deadline in words", () => {
    render(<RoundPlanner items={PLAN} now={NOW} timeZone={TZ} />);
    const lane = screen.getByRole("heading", { name: "Round 2" }).parentElement!;
    const rows = within(lane).getAllByRole("listitem");
    expect(rows[0]!.textContent).toMatch(/^Step 1Northfield.*Start by 10 Nov/);
    // The deadline's source is visible, not only read out.
    const source = within(rows[0]!).getByText(/^Source: Deadlines page, 2026\./);
    expect(source.className).not.toContain("sr-only");
  });
});

describe("HonestFlagList", () => {
  it("leads with risks, each with a word and its source", () => {
    const { container } = render(
      <HonestFlagList
        flags={[
          {
            id: "f1",
            tone: "note",
            text: "Most of the class starts in consulting.",
            citation: DEADLINES,
          },
          {
            id: "f2",
            tone: "risk",
            text: "This school placed 4% of its class in technology last year.",
            citation: { source: "Employment report", year: 2025 },
          },
        ]}
      />,
    );
    const items = [...container.querySelectorAll("li[data-flag]")];
    expect(items.map((li) => li.getAttribute("data-tone"))).toEqual(["risk", "note"]);
    expect(items[0]!.textContent).toContain("Risk");
    expect(items[0]!.textContent).toContain("Source: Employment report, 2025.");
    expect(items[1]!.textContent).toContain("Worth knowing");
  });
});
