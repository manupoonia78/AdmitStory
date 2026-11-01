// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planRevision, type ChangeDecision } from "./revision";
import { RevisionReview } from "./revision-review";
import type { DraftParagraph, DraftSentence } from "./types";

const s = (text: string): DraftSentence => ({ text, kind: "composed", sources: [] });
const DRAFT: DraftParagraph[] = [
  { id: "p1", sentences: [s("One.")] },
  { id: "p2", sentences: [s("The feed was failing.")] },
];

function Review({
  patches,
  onSettled,
}: {
  patches: Parameters<typeof planRevision>[1];
  onSettled: (d: Record<string, ChangeDecision>) => void;
}) {
  const { changes } = planRevision(DRAFT, patches);
  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>({});
  return (
    <>
      <input aria-label="Ask for a change" />
      <RevisionReview
        changes={changes}
        decisions={decisions}
        onDecisionsChange={setDecisions}
        onSettled={onSettled}
        showDiff
      />
    </>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("RevisionReview", () => {
  it("offers Keep change and Undo for one paragraph, and A keeps it", () => {
    const onSettled = vi.fn();
    render(
      <Review
        patches={[{ op: "replace", paragraph_id: "p2", sentences: [s("The feed had stopped.")] }]}
        onSettled={onSettled}
      />,
    );
    expect(screen.getByText("Paragraph 2 rewritten. Review the change.")).toBeTruthy();
    expect(screen.getByRole("group").getAttribute("aria-labelledby")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("group"));
    expect(
      screen.getByRole("button", { name: "Keep change" }).getAttribute("aria-keyshortcuts"),
    ).toBe("A");
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByText("Change kept in paragraph 2.")).toBeTruthy();
    // Undo stays available after keeping.
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(onSettled).toHaveBeenLastCalledWith({ p2: "kept" });
  });

  it("R undoes, but not while typing in a field", () => {
    render(
      <Review
        patches={[{ op: "replace", paragraph_id: "p2", sentences: [s("The feed had stopped.")] }]}
        onSettled={vi.fn()}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Ask for a change" });
    fireEvent.keyDown(field, { key: "r" });
    expect(screen.getByText("Paragraph 2 rewritten. Review the change.")).toBeTruthy();
    fireEvent.keyDown(window, { key: "r" });
    expect(screen.getByText("Change undone. Paragraph 2 is as it was.")).toBeTruthy();
  });

  it("decides several paragraphs one by one, or all at once", () => {
    const onSettled = vi.fn();
    render(
      <Review
        patches={[
          { op: "replace", paragraph_id: "p1", sentences: [s("One, better.")] },
          { op: "replace", paragraph_id: "p2", sentences: [s("The feed had stopped.")] },
        ]}
        onSettled={onSettled}
      />,
    );
    expect(screen.getByText("2 paragraphs changed. Review the changes.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo change to paragraph 1" }));
    // A acts on the next undecided paragraph: 2.
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByText("1 of 2 changes kept.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(onSettled).toHaveBeenLastCalledWith({ p1: "undone", p2: "kept" });
  });

  it("keeps all at once", () => {
    render(
      <Review
        patches={[
          { op: "replace", paragraph_id: "p1", sentences: [s("One, better.")] },
          { op: "delete", paragraph_id: "p2", sentences: null },
        ]}
        onSettled={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep all changes" }));
    expect(screen.getByText("All changes kept.")).toBeTruthy();
  });
});
