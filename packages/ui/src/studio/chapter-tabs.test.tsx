// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChapterTabs, chapterTabId, nextTabIndex } from "./chapter-tabs";

const CHAPTERS = [
  { id: "roots", label: "Roots" },
  { id: "education", label: "Education" },
  { id: "work", label: "Work" },
] as const;

type Id = (typeof CHAPTERS)[number]["id"];

function Harness({ onChange }: { onChange?: (id: Id) => void }) {
  const [value, setValue] = useState<Id>("work");
  return (
    <>
      <ChapterTabs
        chapters={CHAPTERS}
        value={value}
        onChange={(id) => {
          setValue(id);
          onChange?.(id);
        }}
        panelId="panel"
      />
      <div id="panel" role="tabpanel" aria-labelledby={chapterTabId("panel", value)} />
    </>
  );
}

describe("nextTabIndex", () => {
  it("wraps at both ends and jumps with Home and End", () => {
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextTabIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
  });

  it("ignores other keys and empty lists", () => {
    expect(nextTabIndex("Enter", 1, 3)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("ChapterTabs", () => {
  it("is a named tablist whose tabs all control the one panel", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Chapters" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("aria-controls"))).toEqual([
      "panel",
      "panel",
      "panel",
    ]);
    expect(screen.getByRole("tabpanel", { name: "Work" })).toBeTruthy();
  });

  it("keeps only the selected tab in the tab order", () => {
    render(<Harness />);
    const work = screen.getByRole("tab", { name: "Work" });
    expect(work.getAttribute("aria-selected")).toBe("true");
    expect(work.tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "Roots" }).tabIndex).toBe(-1);
  });

  it("moves focus with the arrow keys without opening a chapter", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const work = screen.getByRole("tab", { name: "Work" });
    work.focus();
    fireEvent.keyDown(work, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Roots" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(work);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens a chapter on click", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Education" }));
    expect(onChange).toHaveBeenCalledWith("education");
    expect(screen.getByRole("tab", { name: "Education" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Education" })).toBeTruthy();
  });
});
