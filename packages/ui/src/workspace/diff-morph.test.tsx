// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiffMorph, type MorphDecision } from "./diff-morph";
import { RevisionBar } from "./revision-bar";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

const BEFORE = "I called the vendor, then woke the lab supervisor.";
const AFTER = "At 2:15 I called the vendor's engineer, then woke the lab supervisor.";

const spoken = (container: HTMLElement) => container.querySelector(".sr-only")?.textContent;
const words = (container: HTMLElement, kind: string) =>
  Array.from(container.querySelectorAll(`[data-diff="${kind}"]`)).map((el) =>
    el.textContent?.trim(),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  motionPreference.reduced = false;
});

describe("DiffMorph", () => {
  it("shows the change for review and spells it out for screen readers", () => {
    const { container } = render(
      <p>
        <DiffMorph before={BEFORE} after={AFTER} decision="pending" />
      </p>,
    );
    expect(words(container, "removed")).toEqual(["vendor,"]);
    expect(words(container, "added")).toEqual(["At", "2:15", "vendor's", "engineer,"]);
    expect(spoken(container)).toBe(
      "[added: At 2:15] I called the [removed: vendor,] [added: vendor's engineer,] then woke the lab supervisor.",
    );
    // The visual words are hidden from assistive technology; the spoken version stands in.
    expect(
      container.querySelector("[aria-hidden]")?.contains(container.querySelector("[data-diff]")),
    ).toBe(true);
  });

  it("reads as the new version once kept, and reports when the morph has settled", () => {
    const onSettled = vi.fn();
    const { container, rerender } = render(
      <DiffMorph before={BEFORE} after={AFTER} decision="pending" onSettled={onSettled} />,
    );
    rerender(<DiffMorph before={BEFORE} after={AFTER} decision="kept" onSettled={onSettled} />);
    expect(spoken(container)).toBe(AFTER);
    expect(container.firstElementChild?.getAttribute("data-decision")).toBe("kept");
    act(() => vi.advanceTimersByTime(1000));
    expect(onSettled).toHaveBeenLastCalledWith("kept");
  });

  it("can be reversed mid-morph: only the last decision settles", () => {
    const onSettled = vi.fn();
    const { container, rerender } = render(
      <DiffMorph before={BEFORE} after={AFTER} decision="kept" onSettled={onSettled} />,
    );
    act(() => vi.advanceTimersByTime(100));
    rerender(<DiffMorph before={BEFORE} after={AFTER} decision="undone" onSettled={onSettled} />);
    expect(spoken(container)).toBe(BEFORE);
    act(() => vi.advanceTimersByTime(1000));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith("undone");
  });

  it("starts from `initial` and moves to `decision` after the first frame", async () => {
    vi.useRealTimers();
    const { container } = render(
      <DiffMorph before={BEFORE} after={AFTER} initial="undone" decision="pending" />,
    );
    expect(container.firstElementChild?.getAttribute("data-decision")).toBe("undone");
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
    expect(container.firstElementChild?.getAttribute("data-decision")).toBe("pending");
  });

  it("swaps without blur or movement under reduced motion, settling after 120 ms", () => {
    motionPreference.reduced = true;
    const onSettled = vi.fn();
    const { container, rerender } = render(
      <DiffMorph before={BEFORE} after={AFTER} decision="pending" onSettled={onSettled} />,
    );
    rerender(<DiffMorph before={BEFORE} after={AFTER} decision="kept" onSettled={onSettled} />);
    for (const word of container.querySelectorAll<HTMLElement>("[data-diff]")) {
      expect(word.style.filter).toBe("");
      expect(word.style.transform ?? "").toBe("");
    }
    act(() => vi.advanceTimersByTime(130));
    expect(onSettled).toHaveBeenCalledWith("kept");
  });
});

function Review({ onKeep = vi.fn(), onUndo = vi.fn(), decision = "pending" as MorphDecision }) {
  return (
    <>
      <input aria-label="Ask for a change" />
      <RevisionBar
        decision={decision}
        message="Paragraph 2 rewritten. Review the change."
        detail="193 / 200 words after this change"
        onKeep={onKeep}
        onUndo={onUndo}
      />
    </>
  );
}

describe("RevisionBar", () => {
  it("takes focus and is named by its message", () => {
    render(<Review />);
    const bar = screen.getByRole("group", { name: "Paragraph 2 rewritten. Review the change." });
    expect(document.activeElement).toBe(bar);
    expect(
      screen.getByRole("button", { name: "Keep change" }).getAttribute("aria-keyshortcuts"),
    ).toBe("A");
    expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-keyshortcuts")).toBe(
      "R",
    );
  });

  it("keeps with A and undoes with R, but not while typing", () => {
    const onKeep = vi.fn();
    const onUndo = vi.fn();
    render(<Review onKeep={onKeep} onUndo={onUndo} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "a" });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "r" });
    expect(onKeep).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "a" });
    expect(onKeep).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "R" });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("offers only Undo once kept, and nothing once undone", () => {
    const onKeep = vi.fn();
    const { rerender } = render(<Review decision="kept" onKeep={onKeep} />);
    expect(screen.getByText("Change kept.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keep change" })).toBeNull();
    fireEvent.keyDown(document.body, { key: "a" });
    expect(onKeep).not.toHaveBeenCalled();
    rerender(<Review decision="undone" />);
    expect(screen.getByText("Change undone.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps focus on the bar when the pressed button goes away", () => {
    render(<Review />);
    const keep = screen.getByRole("button", { name: "Keep change" });
    keep.focus();
    fireEvent.click(keep);
    expect(document.activeElement?.getAttribute("role")).toBe("group");
  });
});
