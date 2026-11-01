// @vitest-environment jsdom
// The lens dial with prefers-reduced-motion: reduce.
import "../../test/dom";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { stubReducedMotion } from "../studio/reduced-motion.testing";
import { READINGS } from "./fixtures.testing";
import { stubInView } from "./in-view.testing";
import { LensInstrument } from "./lens-instrument";

stubReducedMotion(true);
stubInView();

describe("LensInstrument with reduced motion", () => {
  it("draws the arcs at their level with no sweep; the dial only fades in", () => {
    const { container } = render(<LensInstrument readings={READINGS} />);
    expect(container.querySelector("section")!.hasAttribute("data-reduced")).toBe(true);
    for (const path of container.querySelectorAll<SVGPathElement>("mask path")) {
      expect(path.getAttribute("stroke-dashoffset")).toBe("0");
      expect(path.style.transition).toBe("");
    }
    const dial = container.querySelector("[data-in]")!;
    expect(dial.className).toContain("transition-opacity");
  });
});
