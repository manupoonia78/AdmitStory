// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceDrawer } from "./evidence";
import { EvidenceLink, evidenceLabel } from "./evidence-link";
import { LensFindings, StrengtheningPlan } from "./findings";
import type { EvidenceRef } from "./types";

const REFS: EvidenceRef[] = [
  { id: "S02", kind: "story", title: "The night-shift fix" },
  { id: "S04", kind: "story", title: "Eight people in a park" },
  { id: "F12", kind: "fact", title: "Managed a team of 6" },
];

describe("evidence", () => {
  it("names one ref by title and several by count", () => {
    expect(evidenceLabel(REFS.slice(0, 1))).toBe("The night-shift fix");
    expect(evidenceLabel(REFS)).toBe("2 stories and 1 fact");
  });

  it("links with every title in its name and hands the refs over", () => {
    const onOpen = vi.fn();
    render(<EvidenceLink refs={REFS} onOpen={onOpen} />);
    const link = screen.getByRole("button", {
      name: "Evidence: The night-shift fix, Eight people in a park, Managed a team of 6",
    });
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith(REFS);
  });

  it("opens a drawer listing what the claim rests on", () => {
    render(
      <EvidenceDrawer
        open
        onOpenChange={() => {}}
        description="Your leadership shows up early."
        items={[
          { ...REFS[0]!, context: "Work, 2024", excerpt: "It was 2 a.m.", href: "/dossier/S02" },
          { ...REFS[2]!, context: "Fact sheet" },
        ]}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "What this is based on" });
    expect(dialog.textContent).toContain("Story, Work, 2024");
    expect(dialog.textContent).toContain("It was 2 a.m.");
    expect(screen.getByRole("link", { name: "Open in Dossier: The night-shift fix" })).toBeTruthy();
  });
});

describe("LensFindings", () => {
  it("has three columns and cites every finding", () => {
    const onOpen = vi.fn();
    render(
      <LensFindings
        onOpenEvidence={onOpen}
        data={{
          lens: "leadership",
          level: "partial",
          helps: [
            {
              id: "h1",
              text: "You led a go-live with no manager in place.",
              evidence: REFS.slice(0, 1),
            },
          ],
          doubts: [],
          actions: [
            {
              id: "a1",
              text: "Find a number for the park story.",
              time: "1 hour",
              evidence: REFS.slice(1, 2),
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Leadership developing" })).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["What helps", "What may raise doubts", "What to do"]);
    expect(screen.getByText("Nothing here a reader is likely to doubt.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Evidence: Eight people in a park" }));
    expect(onOpen).toHaveBeenCalledWith(REFS.slice(1, 2));
  });
});

describe("StrengtheningPlan", () => {
  it("lists actions in order with their time", () => {
    const { container } = render(
      <StrengtheningPlan
        onOpenEvidence={() => {}}
        items={[
          {
            id: "p1",
            text: "Talk to 3 people in your target role.",
            time: "3 weeks",
            evidence: [],
          },
          {
            id: "p2",
            text: "Take a quantitative course.",
            time: "2 months",
            evidence: REFS.slice(2),
          },
        ]}
      />,
    );
    const rows = [...container.querySelectorAll("li[data-action]")];
    expect(rows[0]!.textContent).toBe("1Talk to 3 people in your target role.3 weeks");
    expect(rows[1]!.textContent).toContain("Managed a team of 6");
  });
});
