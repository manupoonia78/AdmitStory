// @vitest-environment jsdom
// Every Studio component with prefers-reduced-motion: reduce (spec §6.6: springs become 120 ms
// opacity fades, nothing moves, nothing morphs). One file, because Motion reads the preference
// once per test file.
import "../../test/dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VoiceSignalRef } from "../voiceprint/types";
import { CAPTURE_SOURCE_ATTRIBUTE } from "./capture-source";
import { LiveTranscript } from "./live-transcript";
import { RecordButton } from "./record-button";
import { stubReducedMotion } from "./reduced-motion.testing";
import { SpokenQuestion } from "./spoken-question";
import { StoryCaptureProvider, StoryShelf, useStoryCapture } from "./story-capture";
import type { StoryCardData } from "./story-card";
import { estimateWordTimings } from "./word-timing";

stubReducedMotion(true);
// Motion measures layout around scroll; jsdom has no scrolling.
window.scrollTo = () => {};

const frames = (count: number) =>
  act(async () => {
    for (let i = 0; i < count; i += 1) await new Promise((r) => requestAnimationFrame(r));
  });

const LOUD: VoiceSignalRef = { current: { amplitude: 1, centroid: 0.5, pitchDelta: 0 } };

describe("with reduced motion", () => {
  it("SpokenQuestion shows every word at full brightness while it is read", async () => {
    const text = "Where did you grow up?";
    const timings = estimateWordTimings(text);
    const { container } = render(
      <SpokenQuestion text={text} timings={timings} clock={() => timings[1]!.startMs} />,
    );
    await frames(3);
    const words = container.querySelectorAll("[aria-hidden='true'] > span");
    expect([...words].every((word) => word.hasAttribute("data-spoken"))).toBe(true);
  });

  it("LiveTranscript keeps a fixed weight instead of following the voice", async () => {
    const { container } = render(
      <LiveTranscript
        segments={[{ id: "a", text: "It was 2 a.m.", final: false }]}
        signal={LOUD}
      />,
    );
    await frames(3);
    expect(container.querySelector("p")!.style.getPropertyValue("--interim-weight")).toBe("");
  });

  it("RecordButton's ring brightens with the voice but does not grow", async () => {
    render(<RecordButton state="listening" onStart={() => {}} onStop={() => {}} signal={LOUD} />);
    const ring = screen
      .getByRole("button", { name: "Record your answer" })
      .querySelector<HTMLElement>("span[aria-hidden='true']")!;
    await frames(4);
    expect(Number(ring.style.opacity)).toBeGreaterThan(0.3);
    expect(ring.style.transform).toBe("");
  });

  it("a captured story simply appears on the shelf, counted and announced, with no flight", () => {
    const FIX: StoryCardData = {
      id: "fix",
      nickname: "The night-shift fix",
      era: "2024",
      context: "Work",
      traits: ["initiative"],
      status: { tone: "needs", label: "Needs one number" },
    };
    function Studio() {
      const { capture, ignited } = useStoryCapture();
      return (
        <>
          <LiveTranscript
            segments={[{ id: "seg", text: "So I wrote a replay queue.", final: true }]}
            ignitedIds={ignited}
          />
          <button type="button" onClick={() => capture(FIX, { sourceId: "seg" })}>
            Find
          </button>
          <StoryShelf />
        </>
      );
    }
    const { container } = render(
      <StoryCaptureProvider>
        <Studio />
      </StoryCaptureProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Your shelf (1)");
    expect(screen.getByRole("button", { name: "The night-shift fix" })).toBeTruthy();
    expect(screen.getByText("New story added to your shelf: The night-shift fix.")).toBeTruthy();
    expect(container.querySelector("[data-flight]")).toBeNull();
    expect(container.querySelector("[data-pending]")).toBeNull();
    expect(
      container.querySelector(`[${CAPTURE_SOURCE_ATTRIBUTE}="seg"]`)!.hasAttribute("data-ignited"),
    ).toBe(false);
  });
});
