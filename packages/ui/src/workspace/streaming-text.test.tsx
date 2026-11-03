// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LimitCounter, overLimit } from "./limit-counter";
import { StreamingText } from "./streaming-text";

const live = (container: HTMLElement) => container.querySelector("[aria-live]") as HTMLElement;

describe("StreamingText", () => {
  it("shows whole sentences only, in a polite live region", () => {
    const { container, rerender } = render(<StreamingText text="It was late. The fe" />);
    const region = live(container);
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-relevant")).toBe("additions");
    expect(region.textContent).toBe("It was late.");

    rerender(<StreamingText text="It was late. The feed dropped." />);
    expect(live(container).textContent).toBe("It was late.");
    rerender(<StreamingText text="It was late. The feed dropped." done />);
    expect(live(container).textContent).toBe("It was late. The feed dropped.");
    expect(live(container).children).toHaveLength(2);
  });

  it("shows text that was already whole on the first render without fading it in", () => {
    const { container, rerender } = render(<StreamingText text="One. Two." done />);
    // Already there when the view appeared: full opacity from the start, server render included.
    for (const span of live(container).children)
      expect((span as HTMLElement).style.opacity).toBe("1");

    // What lands afterwards is streamed, so it fades up from 0.
    rerender(<StreamingText text="One. Two. Three." done />);
    expect((live(container).children[2] as HTMLElement).style.opacity).toBe("0");

    // Replacing the stream starts the run over: every sentence is streamed again, so all fade.
    rerender(<StreamingText text="" />);
    rerender(<StreamingText text="One. Two." />);
    expect((live(container).children[0] as HTMLElement).style.opacity).toBe("0");
  });

  it("reserves the exact shape of expected text, hidden from everyone", () => {
    const { container } = render(
      <StreamingText text="" reserve="It was late. The feed dropped." />,
    );
    const ghost = container.querySelector("[aria-hidden]") as HTMLElement;
    expect(ghost.textContent).toBe("It was late. The feed dropped.");
    expect(ghost.className).toContain("invisible");
    // Ghost and live text share one grid cell, so the box is as tall as the larger of them.
    expect(ghost.className).toContain("row-start-1");
    expect(live(container).className).toContain("row-start-1");
  });

  it("reserves a number of lines", () => {
    const { container } = render(<StreamingText text="" reserve={3} />);
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("3lh");
  });

  it("can stay quiet when something else reports progress", () => {
    const { container } = render(<StreamingText text="One. Two." done live={false} />);
    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(screen.getByText("One.")).toBeTruthy();
  });
});

describe("LimitCounter", () => {
  it("shows the count against the limit", () => {
    render(<LimitCounter count={187} limit={200} />);
    expect(screen.getByText(/\/ 200 words/).textContent).toBe("187 / 200 words");
    expect(overLimit(187, 200)).toBe(0);
  });

  it("says how far over, with words and an icon, never colour alone", () => {
    const { container, rerender } = render(<LimitCounter count={214} limit={200} />);
    expect(screen.getByText("14 words over")).toBeTruthy();
    expect(container.querySelector("svg[aria-hidden]")).not.toBeNull();
    rerender(<LimitCounter count={151} limit={150} unit="characters" />);
    expect(screen.getByText("1 character over")).toBeTruthy();
  });
});
