// @vitest-environment jsdom
// The horizon with prefers-reduced-motion: reduce. Its own file, because Motion reads the
// preference once per test file.
import "../../test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { stubReducedMotion } from "../studio/reduced-motion.testing";
import { NOW, SCHOOLS, TZ } from "./fixtures.testing";
import { HorizonTimeline } from "./horizon-timeline";

stubReducedMotion(true);

describe("HorizonTimeline with reduced motion", () => {
  it("switches to the comparison without a morph and keeps the keyboard path", () => {
    const { container } = render(
      <HorizonTimeline
        schools={SCHOOLS}
        now={NOW}
        timeZone={TZ}
        comparison={<p>Comparison table</p>}
      />,
    );
    const root = container.querySelector("section")!;
    expect(root.hasAttribute("data-reduced")).toBe(true);
    const [northfield, harbor] = within(screen.getByRole("listbox")).getAllByRole("option");
    act(() => northfield!.focus());
    fireEvent.keyDown(northfield!, { key: " " });
    fireEvent.keyDown(northfield!, { key: "ArrowDown" });
    fireEvent.keyDown(harbor!, { key: " " });
    expect(root.hasAttribute("data-comparing")).toBe(true);
    expect(screen.getByText("Comparison table")).toBeTruthy();
    // No marks travel: Motion gets no layout transforms to play.
    for (const option of [northfield!, harbor!]) expect(option.style.transform).toBe("");
  });
});
