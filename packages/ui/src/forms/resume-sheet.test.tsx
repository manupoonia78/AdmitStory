// @vitest-environment jsdom
import "../../test/dom";
import type { BulletDecision, ResumeReview } from "@admitstory/shared/kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResumeSheet, type ResumeSheetProps } from "./resume-sheet";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

afterEach(() => {
  document.body.innerHTML = "";
});

const REVIEW: ResumeReview = {
  header: { name: "Priya Raman", lines: ["priya@example.com"] },
  sections: [
    {
      id: "s1",
      heading: "Experience",
      kind: "experience",
      lines: [],
      roles: [
        {
          id: "r1",
          organisation: "Meridian Health Systems",
          title: "Senior Software Engineer",
          dates: "Apr 2024 – Present",
          location: null,
          bullets: [
            {
              id: "b1",
              original: "Responsible for the onboarding service",
              verdict: "activity",
              issues: ["activity_not_achievement", "quantify"],
              feedback: "Say what changed because of you.",
              rewrite: {
                text: "Cut onboarding time [?1] by rebuilding the onboarding service",
                sources: ["F3"],
                needs: [{ question: "By how much did onboarding time fall?", approx_words: 3 }],
              },
            },
            {
              id: "b2",
              original: "Worked on hospital integrations",
              verdict: "activity",
              issues: ["lead_with_impact"],
              feedback: "Lead with the hospitals it reached.",
              rewrite: {
                text: "Connected 40 hospitals through new integrations",
                sources: ["F4"],
                needs: [],
              },
            },
            {
              id: "b3",
              original: "Led a 13-person team across three time zones",
              verdict: "achievement",
              issues: [],
              feedback: "Already strong.",
              rewrite: null,
            },
          ],
        },
      ],
    },
    {
      id: "s2",
      heading: "Education",
      kind: "education",
      lines: ["BSc Computer Science, 2016"],
      roles: [],
    },
  ],
  section_order: { order: ["s2", "s1"], reason: "Your degree is recent; lead with it." },
  priorities: ["Turn duties into results", "Add numbers", "Cut to one page"],
};

function renderSheet(over: Partial<ResumeSheetProps> = {}) {
  const props: ResumeSheetProps = {
    review: REVIEW,
    decisions: {},
    pageLimit: null,
    useSuggestedOrder: false,
    onToggleOrder: vi.fn(),
    consistency: [],
    onDecide: vi.fn(),
    onExport: vi.fn(),
    ...over,
  };
  const view = render(<ResumeSheet {...props} />);
  return { ...view, props };
}

describe("ResumeSheet", () => {
  it("keeps the rewrite disabled until every detail is answered, then passes the answers", () => {
    const { props } = renderSheet();
    const keep = screen.getByRole("button", { name: /Keep rewrite/ });
    expect((keep as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("By how much did onboarding time fall?"), {
      target: { value: "by 30%" },
    });
    expect((keep as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(keep);
    expect(props.onDecide).toHaveBeenCalledWith("b1", { status: "accepted", answers: ["by 30%"] });
  });

  it("A keeps a rewrite and R keeps the original, from the keyboard", () => {
    const decisions: Record<string, BulletDecision> = { b1: { status: "rejected" } };
    // Focus opens on the first line still waiting for a decision: b2.
    const { props, rerender } = renderSheet({ decisions });
    fireEvent.keyDown(window, { key: "a" });
    expect(props.onDecide).toHaveBeenCalledWith("b2", { status: "accepted", answers: [] });

    rerender(<ResumeSheet {...props} decisions={{}} />);
    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "r" });
    expect(props.onDecide).toHaveBeenCalledWith("b1", { status: "rejected" });
  });

  it("A does nothing while a detail is still open: nothing is guessed", () => {
    const { props } = renderSheet();
    fireEvent.keyDown(window, { key: "a" });
    expect(props.onDecide).not.toHaveBeenCalled();
  });

  it("undoes a decision back to undecided", () => {
    const { props } = renderSheet({ decisions: { b1: { status: "rejected" } } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Line 1\b|Responsible/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(props.onDecide).toHaveBeenCalledWith("b1", null);
  });

  it("shows the page estimate and the end-of-page hairline when the résumé runs over", () => {
    const long: ResumeReview = {
      ...REVIEW,
      sections: [
        ...REVIEW.sections,
        {
          id: "s3",
          heading: "Additional",
          kind: "additional",
          roles: [],
          lines: Array.from({ length: 70 }, (_, i) => `Interest number ${i + 1}`),
        },
      ],
    };
    renderSheet({ review: long, pageLimit: { pages: 1, schools: ["Halvorsen"] } });
    expect(screen.getByLabelText("End of page 1")).toBeTruthy();
    const estimate = document.querySelector("[data-over]");
    expect(estimate?.textContent).toMatch(/About 1\.\d pages/);
  });

  it("has no hairline when the résumé fits its limit", () => {
    renderSheet({ pageLimit: { pages: 1, schools: ["Halvorsen"] } });
    expect(screen.queryByLabelText("End of page 1")).toBeNull();
    expect(document.querySelector("[data-over]")).toBeNull();
  });

  it("toggles the suggested section order and exports", () => {
    const { props } = renderSheet();
    fireEvent.click(screen.getByRole("switch"));
    expect(props.onToggleOrder).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: /Download Word file/ }));
    expect(props.onExport).toHaveBeenCalled();
    expect(screen.getByText("Turn duties into results")).toBeTruthy();
  });
});
