// @vitest-environment jsdom
import "../../test/dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpokenQuestion } from "./spoken-question";
import { TimedText } from "./timed-text";
import { estimateWordTimings } from "./word-timing";

const QUESTION = "Where did you grow up, and what was home like?";
const TIMINGS = estimateWordTimings(QUESTION);

/** Visible word spans, in order (the sentence for screen readers is separate). */
function words(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[aria-hidden='true'] > span")];
}

describe("SpokenQuestion", () => {
  it("is a heading that screen readers hear as one sentence", () => {
    render(<SpokenQuestion text={QUESTION} timings={TIMINGS} />);
    expect(screen.getByRole("heading", { level: 2, name: QUESTION })).toBeTruthy();
  });

  it("shows every word at full brightness when nothing is being read", () => {
    const { container } = render(<SpokenQuestion text={QUESTION} timings={TIMINGS} />);
    const spans = words(container);
    expect(spans).toHaveLength(10);
    expect(spans.every((span) => span.hasAttribute("data-spoken"))).toBe(true);
  });

  it("brightens the words already read and dims the rest while reading", async () => {
    // Frozen half way through the fifth word.
    const fifth = TIMINGS[4]!;
    const clock = () => (fifth.startMs + fifth.endMs) / 2;
    const { container } = render(
      <SpokenQuestion text={QUESTION} timings={TIMINGS} clock={clock} />,
    );
    await waitFor(() => {
      const spoken = words(container).map((span) => span.hasAttribute("data-spoken"));
      expect(spoken).toEqual([true, true, true, true, true, false, false, false, false, false]);
    });
    const upcoming = words(container)[7]!;
    expect(upcoming.className).toContain("text-text-soft");
  });

  it("starts a new reading dimmed, with no flash of the finished sentence", () => {
    const { container } = render(
      <SpokenQuestion text={QUESTION} timings={TIMINGS} clock={() => -100} />,
    );
    expect(words(container).some((span) => span.hasAttribute("data-spoken"))).toBe(false);
  });

  it("calls onReadingEnd once the last word is read, then shows everything", async () => {
    const onEnd = vi.fn();
    const { container } = render(
      <SpokenQuestion
        text={QUESTION}
        timings={TIMINGS}
        clock={() => 60_000}
        onReadingEnd={onEnd}
      />,
    );
    await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
    expect(words(container).every((span) => span.hasAttribute("data-spoken"))).toBe(true);
  });
});

describe("TimedText for captions", () => {
  it("hides words not yet spoken but keeps their space", async () => {
    const clock = () => TIMINGS[1]!.startMs;
    const { container } = render(
      <TimedText text={QUESTION} timings={TIMINGS} clock={clock} upcoming="hidden" />,
    );
    await waitFor(() => expect(words(container)[1]!.hasAttribute("data-spoken")).toBe(true));
    const third = words(container)[2]!;
    expect(third.className).toContain("opacity-0");
    expect(third.textContent).toBe("you");
  });
});
