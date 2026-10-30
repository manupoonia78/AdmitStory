// @vitest-environment jsdom
// The duet stage with prefers-reduced-motion: reduce. Its own file, because Motion reads the
// preference once per test file.
import "../../test/dom";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { stubReducedMotion } from "../studio/reduced-motion.testing";
import { DEFAULT_IDENTITY } from "../voiceprint/params";
import { DuetStage } from "./duet-stage";

stubReducedMotion(true);

// The real Voiceprint is tested in ../voiceprint; here only the props the stage passes matter.
vi.mock("../voiceprint/voiceprint", () => ({
  Voiceprint: (props: { label: string; tone?: string; mood?: string }) => (
    <div role="img" aria-label={props.label} data-tone={props.tone} data-vp-mood={props.mood} />
  ),
}));

describe("DuetStage with reduced motion", () => {
  it("keeps both forms still: nobody comes forward, moods still change", () => {
    const { container } = render(
      <DuetStage
        you={{ identity: DEFAULT_IDENTITY, label: "Your Voiceprint" }}
        interviewer={{ identity: DEFAULT_IDENTITY, label: "Interviewer's Voiceprint" }}
        speaker="interviewer"
      />,
    );
    const you = container.querySelector<HTMLElement>("[data-party='you']")!;
    const interviewer = container.querySelector<HTMLElement>("[data-party='interviewer']")!;
    expect(you.style.transform).toBe("");
    expect(interviewer.style.transform).toBe("");
    expect(interviewer.getAttribute("data-mood")).toBe("speaking");
    expect(you.getAttribute("data-mood")).toBe("listening");
  });
});
