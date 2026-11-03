// @vitest-environment jsdom
import "../../test/dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverageMeter, coverageText, levelFraction, type CoverageLens } from "./coverage-meter";

const LENSES: CoverageLens[] = [
  { id: "school-fit", level: "none", note: "no schools chosen yet" },
  { id: "leadership", level: "partial", note: "no originated idea yet" },
  { id: "academics", level: "strong" },
  { id: "goals", level: "thin" },
  { id: "employability", level: "partial" },
  { id: "self-awareness", level: "thin", note: "no setback story yet" },
];

describe("coverageText", () => {
  it("states the lens, its level and the note in one line", () => {
    expect(
      coverageText({ id: "leadership", level: "partial", note: "no originated idea yet" }),
    ).toBe("Leadership: partial — no originated idea yet");
    expect(coverageText({ id: "academics", level: "strong" })).toBe("Academics: strong");
    expect(coverageText({ id: "school-fit", level: "none" })).toBe("School fit: not yet");
  });
});

describe("levelFraction", () => {
  it("fills the bar in steps, empty for none and full for strong", () => {
    expect(levelFraction("none")).toBe(0);
    expect(levelFraction("thin")).toBeCloseTo(1 / 3);
    expect(levelFraction("partial")).toBeCloseTo(2 / 3);
    expect(levelFraction("strong")).toBe(1);
  });
});

describe("CoverageMeter", () => {
  it("lists the six lenses in the spec's order, each as a sentence", () => {
    render(<CoverageMeter lenses={LENSES} />);
    expect(screen.getByRole("heading", { name: "Coverage" })).toBeTruthy();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector(".sr-only")?.textContent)).toEqual([
      "Academics: strong",
      "Self-awareness: thin — no setback story yet",
      "Employability: partial",
      "Leadership: partial — no originated idea yet",
      "Goals: thin",
      "School fit: not yet — no schools chosen yet",
    ]);
  });

  it("keeps the bars decorative: the words carry the level", () => {
    const { container } = render(<CoverageMeter lenses={LENSES} />);
    const leadership = container.querySelector("[data-lens='leadership']")!;
    expect(leadership.getAttribute("data-level")).toBe("partial");
    const visual = leadership.querySelector("[aria-hidden='true']")!;
    expect(visual.textContent).toContain("partial");
    expect(visual.querySelector("[style]")?.getAttribute("style")).toContain("scaleX(0.66");
  });
});
