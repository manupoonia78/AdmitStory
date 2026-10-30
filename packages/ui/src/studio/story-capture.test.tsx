// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveTranscript, type TranscriptSegment } from "./live-transcript";
import { CAPTURE_SOURCE_ATTRIBUTE } from "./capture-source";
import { IGNITE_MS, StoryCaptureProvider, StoryShelf, useStoryCapture } from "./story-capture";
import type { StoryCardData } from "./story-card";

// Motion measures layout around scroll; jsdom has no scrolling.
window.scrollTo = () => {};

const story = (id: string, nickname: string): StoryCardData => ({
  id,
  nickname,
  era: "2024",
  context: "Work",
  traits: ["initiative"],
  status: { tone: "verified", label: "Confirmed" },
});

const PARK = story("park", "Eight people in a park");
const FIX = story("fix", "The night-shift fix");
const VENDOR = story("vendor", "The vendor who said no");

const SEGMENTS: TranscriptSegment[] = [
  { id: "seg-1", text: "It was 2 a.m.", final: true },
  { id: "seg-2", text: "So I wrote a small replay queue.", final: true },
  { id: "seg-3", text: "And I told the vendor no.", final: true },
];

function Studio() {
  const { capture, ignited, count } = useStoryCapture();
  return (
    <>
      <LiveTranscript segments={SEGMENTS} ignitedIds={ignited} />
      <button type="button" onClick={() => capture(FIX, { sourceId: "seg-2" })}>
        Find fix
      </button>
      <button type="button" onClick={() => capture(VENDOR, { sourceId: "seg-3" })}>
        Find vendor
      </button>
      <output>{count}</output>
      <StoryShelf />
    </>
  );
}

const renderStudio = () =>
  render(
    <StoryCaptureProvider initialStories={[PARK]}>
      <Studio />
    </StoryCaptureProvider>,
  );

const shelfNames = () =>
  within(screen.getByRole("region", { name: /Your shelf/ }))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

// jsdom lays nothing out, so give transcript segments (the flight's origin) and the window a size.
const originalRect = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function rect(this: Element) {
    if (this.hasAttribute(CAPTURE_SOURCE_ATTRIBUTE) || this.tagName === "ARTICLE") {
      return DOMRect.fromRect({ x: 40, y: 500, width: 320, height: 40 });
    }
    return originalRect.call(this);
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  vi.useRealTimers();
});

describe("StoryShelf", () => {
  it("lists the stories with the count in its heading", () => {
    renderStudio();
    expect(screen.getByRole("heading", { level: 2, name: "Your shelf (1)" })).toBeTruthy();
    expect(shelfNames()).toEqual(["Eight people in a park"]);
  });

  it("opens a story in place", () => {
    renderStudio();
    const toggle = screen.getByRole("button", { name: "Eight people in a park" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("explains an empty shelf", () => {
    render(
      <StoryCaptureProvider>
        <StoryShelf />
      </StoryCaptureProvider>,
    );
    expect(
      screen.getByText("No stories yet. Talk for five minutes and they'll start appearing here."),
    ).toBeTruthy();
  });
});

describe("story capture", () => {
  it("ignites the phrase and reserves a hidden slot before the card arrives", () => {
    vi.useFakeTimers();
    const { container } = renderStudio();
    fireEvent.click(screen.getByRole("button", { name: "Find fix" }));

    const phrase = container.querySelector(`[${CAPTURE_SOURCE_ATTRIBUTE}="seg-2"]`)!;
    expect(phrase.hasAttribute("data-ignited")).toBe(true);
    const slot = container.querySelector("[data-story='fix']")!;
    expect(slot.hasAttribute("data-pending")).toBe(true);
    expect(slot.getAttribute("aria-hidden")).toBe("true");
    // Not counted or announced until it lands.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Your shelf (1)");
    expect(container.querySelector("p[role=status]")!.textContent).toBe("");

    // After the ignite, the card lifts off from the phrase.
    act(() => vi.advanceTimersByTime(IGNITE_MS));
    expect(container.querySelector("[data-flight='fix']")).not.toBeNull();
  });

  it("lands on the shelf: counted, announced, and the phrase settles back", async () => {
    const { container } = renderStudio();
    fireEvent.click(screen.getByRole("button", { name: "Find fix" }));
    await waitFor(
      () => expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Your shelf (2)"),
      { timeout: 4000 },
    );
    expect(shelfNames()).toEqual(["The night-shift fix", "Eight people in a park"]);
    expect(screen.getByText("New story added to your shelf: The night-shift fix.")).toBeTruthy();
    expect(container.querySelector("[data-flight]")).toBeNull();
    expect(
      container
        .querySelector(`[${CAPTURE_SOURCE_ATTRIBUTE}="seg-2"]`)!
        .hasAttribute("data-ignited"),
    ).toBe(false);
  });

  it("survives a second detection mid-flight: both land in captured order", async () => {
    const { container } = renderStudio();
    fireEvent.click(screen.getByRole("button", { name: "Find fix" }));
    await waitFor(() => expect(container.querySelector("[data-flight='fix']")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Find vendor" }));
    expect(container.querySelector("[data-flight='fix']")).not.toBeNull();

    await waitFor(() => expect(screen.getByText("3", { selector: "output" })).toBeTruthy(), {
      timeout: 4000,
    });
    expect(shelfNames()).toEqual([
      "The vendor who said no",
      "The night-shift fix",
      "Eight people in a park",
    ]);
    expect(container.querySelector("[data-flight]")).toBeNull();
  });

  it("captures a story only once", async () => {
    renderStudio();
    const find = screen.getByRole("button", { name: "Find fix" });
    fireEvent.click(find);
    fireEvent.click(find);
    await waitFor(() => expect(screen.getByText("2", { selector: "output" })).toBeTruthy(), {
      timeout: 4000,
    });
    fireEvent.click(find);
    expect(shelfNames()).toHaveLength(2);
  });
});
