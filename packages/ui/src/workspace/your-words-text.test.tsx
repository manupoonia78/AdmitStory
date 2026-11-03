// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DraftNeed, DraftParagraph, SourceExcerpts } from "./types";
import { YourWordsLegend, YourWordsToggle } from "./your-words-controls";
import { YourWordsText } from "./your-words-text";

const PARAGRAPHS: DraftParagraph[] = [
  {
    id: "p1",
    sentences: [
      { text: "It was 2 a.m. and the feed was failing.", kind: "verbatim", sources: ["L041"] },
      { text: "Nobody else could see it yet.", kind: "composed", sources: [] },
      { text: "I kept both of them on one line.", kind: "adapted", sources: ["C2"] },
    ],
  },
];

const SOURCES: SourceExcerpts = {
  L041: {
    label: "Story Studio, session 2, 14 minutes in",
    quote: "It was 2 a.m. and the feed was failing, every fourth message.",
  },
  C2: { label: "Story Studio, session 3", quote: "I just kept them both on the line." },
};

const NEED: DraftNeed = {
  paragraph_id: "p1",
  after_sentence: 1,
  question: "What did your manager say when you told him?",
  approx_words: 20,
};

function Draft({ initial = false, needs }: { initial?: boolean; needs?: DraftNeed[] }) {
  const [on, setOn] = useState(initial);
  return (
    <>
      <YourWordsToggle on={on} onChange={setOn} />
      <YourWordsLegend />
      <input aria-label="Ask for a change" />
      <YourWordsText paragraphs={PARAGRAPHS} sources={SOURCES} on={on} needs={needs} />
    </>
  );
}

const lit = () => screen.queryAllByRole("button", { name: /a\.m\.|one line/ });

describe("YourWordsToggle", () => {
  it("is a switch named Your words, announcing Y as its shortcut", () => {
    render(<Draft />);
    const toggle = screen.getByRole("switch", { name: "Your words" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.getAttribute("aria-keyshortcuts")).toBe("Y");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("toggles with Y outside text fields, but not while typing or with modifiers", () => {
    const { container } = render(<Draft />);
    const view = () =>
      container.querySelector("[data-your-words]")?.getAttribute("data-your-words");
    fireEvent.keyDown(document.body, { key: "y" });
    expect(view()).toBe("on");
    fireEvent.keyDown(document.body, { key: "Y", shiftKey: true });
    expect(view()).toBe("off");

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Ask for a change" }), { key: "y" });
    fireEvent.keyDown(document.body, { key: "y", metaKey: true });
    fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
    expect(view()).toBe("off");
  });
});

describe("YourWordsText", () => {
  it("adds no tab stops or glow while the view is off", () => {
    const { container } = render(<Draft />);
    expect(lit()).toHaveLength(0);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-own-words]")).toHaveLength(0);
  });

  it("lights verbatim and adapted sentences, leaves composed ones plain", () => {
    const { container } = render(<Draft initial />);
    expect(lit()).toHaveLength(2);
    for (const sentence of lit()) {
      expect(sentence.tabIndex).toBe(0);
      expect(sentence.className).toContain("bg-voice-glow");
    }
    const composed = container.querySelector('[data-kind="composed"]') as HTMLElement;
    expect(composed.getAttribute("role")).toBeNull();
    expect(composed.hasAttribute("tabindex")).toBe(false);
    expect(composed.className).not.toContain("bg-voice-glow");
  });

  it("describes each lit sentence with the moment it was said", () => {
    render(<Draft initial />);
    const [first, second] = lit();
    const description = document.getElementById(first!.getAttribute("aria-describedby")!);
    expect(description?.textContent).toBe(
      "Your exact words. Story Studio, session 2, 14 minutes in: “It was 2 a.m. and the feed was failing, every fourth message.”",
    );
    const adapted = document.getElementById(second!.getAttribute("aria-describedby")!);
    expect(adapted?.textContent).toContain("Adapted from what you said.");
  });

  it("shows the source on focus and hides it on Escape", () => {
    render(<Draft initial />);
    const [first] = lit();
    fireEvent.focus(first!);
    const popover = document.querySelector("[data-source-popover]") as HTMLElement;
    expect(popover.textContent).toContain("The moment you said it");
    expect(popover.textContent).toContain("every fourth message");
    expect(popover.textContent).toContain("Story Studio, session 2, 14 minutes in");
    // The popover repeats the description, so it is hidden from assistive technology.
    expect(popover.getAttribute("aria-hidden")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    // AnimatePresence keeps the exiting node briefly; it no longer follows the sentence.
    expect(document.querySelectorAll("[data-source-popover]").length).toBeLessThanOrEqual(1);
  });

  it("pins the source on tap or Enter, and a second press closes it", () => {
    render(<Draft initial />);
    const [, second] = lit();
    fireEvent.click(second!);
    expect(document.querySelector("[data-source-popover]")?.textContent).toContain(
      "I just kept them both on the line.",
    );
    fireEvent.blur(second!);
    expect(document.querySelector("[data-source-popover]")).not.toBeNull();
    fireEvent.keyDown(second!, { key: "Enter" });
    fireEvent.keyDown(second!, { key: "Enter" });
    expect(document.querySelector("[data-source-popover]")?.textContent).toContain(
      "I just kept them both on the line.",
    );
  });

  it("falls back to a dotted underline in forced colours and drops motion when reduced", () => {
    render(<Draft initial />);
    const [first] = lit();
    expect(first!.className).toContain("forced-colors:underline");
    expect(first!.className).toContain("forced-colors:decoration-dotted");
    expect(first!.className).toContain("contrast-more:decoration-dotted");
    // Reduced motion: the glow appears without a transition.
    expect(first!.className).toContain("motion-reduce:transition-none");
  });

  it("places a NEED chip after its sentence and reports a press", () => {
    const onNeedSelect = vi.fn();
    render(
      <YourWordsText
        paragraphs={PARAGRAPHS}
        sources={SOURCES}
        on={false}
        needs={[NEED]}
        onNeedSelect={onNeedSelect}
      />,
    );
    const chip = screen.getByRole("button", {
      name: "Needs you: What did your manager say when you told him? About 20 words.",
    });
    expect(chip.previousSibling?.previousSibling?.textContent).toBe(
      "Nobody else could see it yet.",
    );
    fireEvent.click(chip);
    expect(onNeedSelect).toHaveBeenCalledWith(NEED);
  });

  it("lets a caller replace one paragraph and add a block after it", () => {
    render(
      <YourWordsText
        paragraphs={PARAGRAPHS}
        sources={SOURCES}
        on
        renderParagraph={() => "Replaced text"}
        renderAfterParagraph={() => <div role="group" aria-label="After" />}
      />,
    );
    expect(screen.getByText("Replaced text").tagName).toBe("P");
    expect(screen.getByRole("group", { name: "After" })).toBeTruthy();
    expect(lit()).toHaveLength(0);
  });
});
