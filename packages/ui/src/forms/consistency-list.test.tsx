// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ConsistencyFinding } from "@admitstory/linters";
import { describe, expect, it, vi } from "vitest";
import {
  CONSISTENCY_EMPTY,
  ConsistencyList,
  canUseExpected,
  referenceValue,
} from "./consistency-list";

const TITLE: ConsistencyFinding = {
  id: "title:meridian:analyst|lead analyst|senior analyst",
  rule_id: "consistency.title",
  severity: "must",
  subject: "title",
  what: "Your title at Meridian Health",
  values: [
    {
      said: "Senior Analyst",
      docId: "fact_sheet",
      docKind: "fact_sheet",
      docLabel: "Fact Sheet",
      ref: "F3",
      excerpt: "Senior Analyst, 2022–2024",
    },
    {
      said: "Analyst",
      docId: "resume",
      docKind: "resume",
      docLabel: "Resume",
      ref: "b2",
      excerpt: "Promoted to Analyst at Meridian Health",
    },
    {
      said: "Senior Analyst",
      docId: "employment",
      docKind: "form",
      docLabel: "Form: Employment history",
      ref: "employment/i1",
      excerpt: "Senior Analyst at Meridian",
    },
    {
      said: "Lead Analyst",
      docId: "essay-1",
      docKind: "essay",
      docLabel: "Essay 1",
      ref: "p2",
      excerpt: "as Lead Analyst I",
    },
  ],
  expected: "Senior Analyst",
  explanation: 'Your resume says "Analyst"; Essay 1 says "Lead Analyst".',
  fix_hint: "Use your Fact Sheet title everywhere.",
};

const TEAM: ConsistencyFinding = {
  id: "team_size:go-live:13|15",
  rule_id: "consistency.team_size",
  severity: "must",
  subject: "team_size",
  what: "Team size",
  values: [
    {
      said: "13",
      docId: "resume",
      docKind: "resume",
      docLabel: "Resume",
      ref: "b4",
      excerpt: "a 13-person team",
    },
    {
      said: "15",
      docId: "employment",
      docKind: "form",
      docLabel: "Form: Employment history",
      ref: "employment/i2",
      excerpt: "15 people",
    },
  ],
  expected: null,
  explanation: 'Your resume says "13"; your form says "15".',
  fix_hint: "Pick one number.",
};

describe("ConsistencyList", () => {
  it("shows each finding as a Must fix row with every place and what it says", () => {
    render(<ConsistencyList findings={[TITLE]} />);
    expect(screen.getByRole("heading", { name: /Must fix/ }).textContent).toContain("(1)");
    expect(screen.getByText("Your title at Meridian Health")).toBeTruthy();
    expect(screen.getByText(TITLE.explanation)).toBeTruthy();
    const row = document.querySelector('[data-doc="resume"]') as HTMLElement;
    expect(row.hasAttribute("data-differs")).toBe(true);
    // The odd one out carries an icon and words, not colour alone.
    expect(row.textContent).toContain("does not match");
    expect(document.querySelector('[data-doc="employment"]')?.hasAttribute("data-differs")).toBe(
      false,
    );
    expect(document.querySelector('[data-doc="fact_sheet"]')?.textContent).toContain(
      "approved phrasing on your Fact Sheet",
    );
  });

  it("offers Use “expected” here only for résumé and form values that differ", () => {
    const onUseExpected = vi.fn();
    render(
      <ConsistencyList
        findings={[TITLE]}
        onUseExpected={onUseExpected}
        hrefFor={(value) => `/workspace/${value.docId}`}
      />,
    );
    const fixes = screen.getAllByRole("button", { name: "Use “Senior Analyst” here" });
    expect(fixes).toHaveLength(1);
    fireEvent.click(fixes[0]!);
    expect(onUseExpected).toHaveBeenCalledWith(TITLE, TITLE.values[1]);
    // A résumé role heading comes from the uploaded file: it's changed there, not here.
    expect(canUseExpected(TITLE, { ...TITLE.values[1]!, ref: "r1.title" })).toBe(false);
    // The essay is prose: it gets a link to open it, not a one-click fix.
    const essay = document.querySelector('[data-doc="essay-1"]') as HTMLElement;
    expect(within(essay).queryByRole("button")).toBeNull();
    expect(within(essay).getByRole("link", { name: "Open Essay 1" }).getAttribute("href")).toBe(
      "/workspace/essay-1",
    );
  });

  it("offers no one-click fix without a Fact Sheet value, and still marks the odd one out", () => {
    render(<ConsistencyList findings={[TEAM]} onUseExpected={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Use/ })).toBeNull();
    expect(referenceValue(TEAM)).toBe("13");
    expect(document.querySelector('[data-doc="employment"]')?.hasAttribute("data-differs")).toBe(
      true,
    );
  });

  it("dismisses a finding as different things", () => {
    const onDismiss = vi.fn();
    render(<ConsistencyList findings={[TITLE, TEAM]} onDismiss={onDismiss} />);
    const buttons = screen.getAllByRole("button", { name: "These are different things" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]!);
    expect(onDismiss).toHaveBeenCalledWith(TEAM);
  });

  it("says everything matches when there is nothing to fix, in a polite live region", () => {
    const { container } = render(<ConsistencyList findings={[]} />);
    expect(screen.getByText(CONSISTENCY_EMPTY)).toBeTruthy();
    expect(CONSISTENCY_EMPTY).toBe("Everything matches across your resume, forms and essays.");
    expect(container.querySelector("section")?.getAttribute("aria-live")).toBe("polite");
  });
});
