// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { READINGS } from "./fixtures.testing";
import { stubInView } from "./in-view.testing";
import { LensInstrument } from "./lens-instrument";
import { LensList } from "./lens-list";

stubInView();

function arcs() {
  return screen.getAllByRole("button").filter((el) => el.hasAttribute("data-lens"));
}

describe("LensInstrument", () => {
  it("labels every arc with its level and how many stories make it", () => {
    render(<LensInstrument readings={READINGS} />);
    expect(screen.getByRole("region", { name: "Your four lenses" })).toBeTruthy();
    expect(arcs().map((arc) => arc.getAttribute("aria-label"))).toEqual([
      "Academics: developing, from 1 story",
      "Self-awareness: thin, no stories listed",
      "Employability: strong, from 2 stories",
      "Leadership: developing, from 3 stories",
    ]);
    // One segment per story.
    const leadership = arcs()[3]!;
    expect(leadership.querySelectorAll("[data-segment]")).toHaveLength(3);
  });

  it("fills the arcs once the dial is in view", () => {
    const { container } = render(<LensInstrument readings={READINGS} />);
    // stubInView reports the dial in view as soon as it mounts.
    expect(container.querySelector("section")!.hasAttribute("data-entered")).toBe(true);
    const mask = container.querySelector("mask path")!;
    expect(mask.getAttribute("stroke-dashoffset")).toBe("0");
    expect((mask as SVGPathElement).style.transition).toContain("var(--spring-drift)");
  });

  it("is one Tab stop; arrows move between arcs and focus reveals the lens's stories", () => {
    render(<LensInstrument readings={READINGS} />);
    const all = arcs();
    expect(all.filter((arc) => arc.getAttribute("tabindex") === "0")).toHaveLength(1);
    act(() => all[0]!.focus());
    fireEvent.keyDown(all[0]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(all[3]);
    expect(all[3]!.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(all[3]!.getAttribute("aria-controls")!)!;
    expect(within(panel).getByText("Eight people in a park")).toBeTruthy();
    // The other arcs step back.
    expect(all[0]!.getAttribute("class")).toContain("opacity-35");
    fireEvent.keyDown(all[3]!, { key: "Escape" });
    expect(all[3]!.getAttribute("aria-expanded")).toBe("false");
    expect(within(panel).getByText("Choose a lens to see the stories behind it.")).toBeTruthy();
  });

  it("reveals stories on hover and opens one in the evidence drawer", () => {
    const onOpenStory = vi.fn();
    render(<LensInstrument readings={READINGS} onOpenStory={onOpenStory} />);
    fireEvent.pointerEnter(arcs()[2]!);
    fireEvent.click(screen.getByRole("button", { name: /The vendor audit/ }));
    expect(onOpenStory).toHaveBeenCalledWith("S03");
  });

  it("shows the focused lens, not a lens the pointer left resting on", () => {
    render(<LensInstrument readings={READINGS} />);
    const all = arcs();
    fireEvent.pointerEnter(all[2]!);
    expect(all[2]!.getAttribute("aria-expanded")).toBe("true");
    act(() => all[0]!.focus());
    expect(all[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(all[2]!.getAttribute("aria-expanded")).toBe("false");
  });

  it("says how to fill an empty dial", () => {
    render(<LensInstrument readings={[]} />);
    expect(
      screen.getByText(
        "No stories behind your lenses yet. Talk for five minutes in Story Studio and they'll fill in.",
      ),
    ).toBeTruthy();
  });
});

describe("LensList", () => {
  it("says the same as the dial as a plain list", () => {
    render(<LensList readings={READINGS} />);
    expect(
      screen.getByRole("heading", { name: "Leadership: developing, from 3 stories" }),
    ).toBeTruthy();
    expect(screen.getAllByText("The night-shift fix")).toHaveLength(2);
  });
});
