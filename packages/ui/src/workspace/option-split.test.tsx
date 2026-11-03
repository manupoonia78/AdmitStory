// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OptionSplit, splitForKey } from "./option-split";

const A = {
  label: "Option A",
  pitch: "The night-shift fix, told as one night",
  paragraphs: ["It was 2 a.m. and the feed was failing.", "I stayed."],
  recommended: true,
};
const B = {
  label: "Option B",
  paragraphs: ["It was 2 a.m. and the runbook was open."],
};

describe("splitForKey", () => {
  it("steps 5% with arrows, 10% with pages, and clamps to 20–80%", () => {
    expect(splitForKey(0.5, "ArrowRight")).toBeCloseTo(0.55);
    expect(splitForKey(0.5, "ArrowLeft")).toBeCloseTo(0.45);
    expect(splitForKey(0.5, "PageUp")).toBeCloseTo(0.6);
    expect(splitForKey(0.22, "PageDown")).toBe(0.2);
    expect(splitForKey(0.5, "Home")).toBe(0.2);
    expect(splitForKey(0.5, "End")).toBe(0.8);
    expect(splitForKey(0.5, "a")).toBeNull();
  });
});

describe("OptionSplit", () => {
  it("is a keyboard-operable separator that reports both widths", () => {
    render(<OptionSplit left={A} right={B} />);
    const divider = screen.getByRole("separator", { name: "Width of Option A and Option B" });
    expect(divider.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(divider.getAttribute("aria-valuenow")).toBe("55");
    expect(divider.getAttribute("aria-valuetext")).toBe("Option A 55%, Option B 45%");
    fireEvent.keyDown(divider, { key: "End" });
    expect(divider.getAttribute("aria-valuenow")).toBe("80");
    fireEvent.keyDown(divider, { key: "Home" });
    expect(divider.getAttribute("aria-valuenow")).toBe("20");
  });

  it("marks only the words that differ, on each side", () => {
    const { container } = render(<OptionSplit left={A} right={B} />);
    const left = screen.getByRole("region", { name: "Option A" });
    const right = screen.getByRole("region", { name: "Option B" });
    const marked = (el: HTMLElement) =>
      [...el.querySelectorAll("[data-differs]")].map((n) => n.textContent);
    expect(marked(left)).toEqual(["feed", "failing.", "I", "stayed."]);
    expect(marked(right)).toEqual(["runbook", "open."]);
    expect(container.textContent).toContain("Option A, recommended");
  });

  it("lights differing words near the divider as it moves, then lets them settle", () => {
    vi.useFakeTimers();
    const { container } = render(<OptionSplit left={A} right={B} />);
    const divider = screen.getByRole("separator");
    // jsdom has no layout: every box sits at 0, so every differing word is "near".
    fireEvent.keyDown(divider, { key: "ArrowLeft" });
    act(() => vi.advanceTimersByTime(20));
    expect(container.querySelectorAll("[data-near]").length).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelectorAll("[data-near]").length).toBe(0);
    vi.useRealTimers();
  });

  it("offers Use this option on each side", () => {
    const onUse = vi.fn();
    render(<OptionSplit left={A} right={B} onUse={onUse} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Option B" }));
    expect(onUse).toHaveBeenCalledWith("right");
  });
});
