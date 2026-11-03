// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { stubReducedMotion } from "../studio/reduced-motion.testing";
import { NOW, SCHOOLS, TZ } from "./fixtures.testing";
import { HorizonList, HorizonPlaceholder } from "./horizon-list";
import { HorizonTimeline } from "./horizon-timeline";

stubReducedMotion(false);

function renderHorizon(props: Partial<Parameters<typeof HorizonTimeline>[0]> = {}) {
  return render(
    <HorizonTimeline
      schools={SCHOOLS}
      now={NOW}
      timeZone={TZ}
      comparison={<p>Comparison table</p>}
      {...props}
    />,
  );
}

function options() {
  return within(screen.getByRole("listbox")).getAllByRole("option");
}

describe("HorizonTimeline", () => {
  it("is one Tab stop, a multi-select list of schools named with their rounds", () => {
    renderHorizon();
    const listbox = screen.getByRole("listbox");
    expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
    const all = options();
    expect(all).toHaveLength(3);
    expect(all.filter((option) => option.tabIndex === 0)).toHaveLength(1);
    expect(all[0]!.getAttribute("aria-label")).toMatch(/^Northfield\. Round 1/);
    expect(all[2]!.getAttribute("aria-label")).toBe("Westbridge, pack coming soon");
  });

  it("selects with the keyboard and morphs into a comparison at two schools", () => {
    const onSelectionChange = vi.fn();
    renderHorizon({ onSelectionChange });
    const [northfield, harbor] = options();
    act(() => northfield!.focus());
    fireEvent.keyDown(northfield!, { key: " " });
    expect(onSelectionChange).toHaveBeenLastCalledWith(["northfield"]);
    expect(northfield!.getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("Comparison table")).toBeNull();
    expect(screen.getByText("Northfield selected. Select one more to compare.")).toBeTruthy();

    fireEvent.keyDown(northfield!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(harbor);
    expect(harbor!.tabIndex).toBe(0);
    fireEvent.keyDown(harbor!, { key: "Enter" });

    expect(onSelectionChange).toHaveBeenLastCalledWith(["northfield", "harbor"]);
    expect(screen.getByText("Comparison table")).toBeTruthy();
    expect(screen.getByText("Comparing Northfield and Harbor.")).toBeTruthy();
    // The same elements are re-laid out, so focus stays on the school.
    expect(document.activeElement).toBe(harbor);
    expect(harbor!.dataset.shape).toBe("column");
    expect(options()[2]!.dataset.shape).toBe("folded");
  });

  it("moves in the order schools appear, jumps with Home and End, clears with Escape", () => {
    renderHorizon({ defaultSelectedIds: ["harbor", "westbridge"] });
    const [northfield, harbor, westbridge] = options();
    // Comparing: Harbor and Westbridge are the columns, Northfield folds beneath them.
    act(() => harbor!.focus());
    fireEvent.keyDown(harbor!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(westbridge);
    fireEvent.keyDown(westbridge!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(northfield);
    fireEvent.keyDown(northfield!, { key: "Home" });
    expect(document.activeElement).toBe(harbor);
    fireEvent.keyDown(harbor!, { key: "End" });
    expect(document.activeElement).toBe(northfield);

    fireEvent.keyDown(northfield!, { key: "Escape" });
    expect(options().every((option) => option.getAttribute("aria-selected") === "false")).toBe(
      true,
    );
    expect(screen.getByText("Comparison cleared.")).toBeTruthy();
  });

  it("toggles with a click and respects a controlled selection", () => {
    const onSelectionChange = vi.fn();
    renderHorizon({ selectedIds: ["northfield"], onSelectionChange });
    fireEvent.click(options()[1]!);
    expect(onSelectionChange).toHaveBeenCalledWith(["northfield", "harbor"]);
    // Controlled: nothing changes until the parent passes the new selection.
    expect(options()[1]!.getAttribute("aria-selected")).toBe("false");
  });

  it("says what to do when there are no schools", () => {
    renderHorizon({ schools: [] });
    expect(screen.getByRole("heading", { name: "No schools yet" })).toBeTruthy();
    expect(screen.getByText("Search for one to see its rounds and what it asks for.")).toBeTruthy();
  });
});

describe("HorizonList", () => {
  it("lists every round in words, with its source", () => {
    render(<HorizonList schools={SCHOOLS} now={NOW} timeZone={TZ} />);
    const northfield = screen.getByRole("heading", { name: "Northfield" }).closest("li")!;
    expect(northfield.textContent).toMatch(/Round 2, 7 Jan 2027, 10:29 GMT\+5:30, 68 days left/);
    expect(northfield.textContent).toContain("Deadlines page, 2026. Verified 12 Sep 2026");
    const westbridge = screen.getByRole("heading", { name: "Westbridge" }).closest("li")!;
    expect(westbridge.textContent).toContain("Pack coming soon");
  });
});

describe("HorizonPlaceholder", () => {
  it("holds one lane per school and is hidden from assistive technology", () => {
    const { container } = render(<HorizonPlaceholder count={3} />);
    const placeholder = container.querySelector("[data-placeholder='horizon']")!;
    expect(placeholder.getAttribute("aria-hidden")).toBe("true");
    expect(placeholder.querySelectorAll("[style*='min-height: 4rem']")).toHaveLength(3);
  });
});
