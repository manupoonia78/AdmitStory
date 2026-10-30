// @vitest-environment jsdom
import "../../test/dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VoiceSignalRef } from "../voiceprint/types";
import { LiveTranscript, interimWeight, type TranscriptSegment } from "./live-transcript";

const SEGMENTS: TranscriptSegment[] = [
  { id: "s1", text: "It was 2 a.m. on the second night,", final: true },
  { id: "s2", text: "and the feed from the lab system", final: false },
];

describe("LiveTranscript", () => {
  it("shows interim words at 40% and weight 500, final words at full opacity and 400", () => {
    const { container } = render(<LiveTranscript segments={SEGMENTS} />);
    const final = container.querySelector("[data-capture-source='s1'] span > span")!;
    const interim = container.querySelector("[data-capture-source='s2'] span > span")!;
    expect(final.className).toContain("opacity-100");
    expect(final.className).toContain("font-normal");
    expect(interim.hasAttribute("data-interim")).toBe(true);
    expect(interim.className).toContain("opacity-40");
    expect(interim.className).toContain("var(--interim-weight,500)");
  });

  it("splits text into whole words, never characters", () => {
    const { container } = render(<LiveTranscript segments={SEGMENTS} />);
    const words = container.querySelectorAll("[data-capture-source='s2'] > span");
    expect(words).toHaveLength(7);
    expect(words[1]!.textContent).toBe("the ");
  });

  it("announces final segments only, through a polite log", () => {
    render(<LiveTranscript segments={SEGMENTS} label="Your answer" />);
    const log = screen.getByRole("log", { name: "Your answer" });
    expect(log.getAttribute("aria-live")).toBe("polite");
    expect(log.textContent).toBe("It was 2 a.m. on the second night,");
  });

  it("keeps the visual copy away from screen readers", () => {
    const { container } = render(<LiveTranscript segments={SEGMENTS} />);
    const visual = container.querySelector("[data-capture-source='s1']")!.closest("[aria-hidden]");
    expect(visual?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lights an ignited segment in the applicant's hue", () => {
    const { container } = render(
      <LiveTranscript segments={SEGMENTS} ignitedIds={new Set(["s1"])} />,
    );
    const lit = container.querySelector("[data-capture-source='s1']")!;
    expect(lit.hasAttribute("data-ignited")).toBe(true);
    expect(lit.className).toContain("text-voice");
    expect(
      container.querySelector("[data-capture-source='s2']")!.hasAttribute("data-ignited"),
    ).toBe(false);
  });

  it("shows the empty message until words arrive", () => {
    const { rerender } = render(
      <LiveTranscript segments={[]} empty="Your words will appear here." />,
    );
    expect(screen.getByText("Your words will appear here.")).toBeTruthy();
    rerender(<LiveTranscript segments={SEGMENTS} empty="Your words will appear here." />);
    expect(screen.queryByText("Your words will appear here.")).toBeNull();
  });

  it("drives the interim weight from the voice signal, outside React", async () => {
    const signal: VoiceSignalRef = { current: { amplitude: 1, centroid: 0.5, pitchDelta: 0 } };
    const { container } = render(<LiveTranscript segments={SEGMENTS} signal={signal} />);
    const text = container.querySelector("p")!;
    await waitFor(() =>
      expect(Number(text.style.getPropertyValue("--interim-weight"))).toBeGreaterThan(530),
    );
  });
});

describe("interimWeight", () => {
  it("moves 60 either side of 500 with amplitude", () => {
    expect(interimWeight(0)).toBe(440);
    expect(interimWeight(0.5)).toBe(500);
    expect(interimWeight(1)).toBe(560);
    expect(interimWeight(3)).toBe(560);
    expect(interimWeight(-1)).toBe(440);
  });
});
