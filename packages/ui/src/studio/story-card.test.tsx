// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryCard, type StoryCardData } from "./story-card";

const STORY: StoryCardData = {
  id: "fix",
  nickname: "The night-shift fix",
  era: "2024",
  context: "Work",
  traits: ["initiative", "ownership", "calm under pressure", "technical depth"],
  status: { tone: "needs", label: "Needs one number" },
  summary: "Wrote a replay queue at 2 a.m. so lab results reached the wards before rounds.",
};

describe("StoryCard", () => {
  it("names the story in a heading and keeps era and context as separate words", () => {
    render(<StoryCard story={STORY} />);
    const card = screen.getByRole("article");
    expect(
      within(card).getByRole("heading", { level: 3, name: "The night-shift fix" }),
    ).toBeTruthy();
    expect(within(card).getByText("Work").tagName).toBe("SPAN");
    expect(within(card).getByText("2024").tagName).toBe("SPAN");
  });

  it("shows at most three trait tags", () => {
    render(<StoryCard story={STORY} />);
    const traits = screen.getByRole("list", { name: "Traits" });
    expect(
      within(traits)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["initiative", "ownership", "calm under pressure"]);
  });

  it("states its status in words with an icon, not colour alone", () => {
    render(<StoryCard story={STORY} />);
    const status = screen.getByText("Needs one number");
    expect(status.parentElement?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows the summary only when expanded", () => {
    const { rerender } = render(<StoryCard story={STORY} />);
    expect(screen.queryByText(STORY.summary!)).toBeNull();
    rerender(<StoryCard story={STORY} variant="expanded" />);
    expect(screen.getByText(STORY.summary!)).toBeTruthy();
    expect(screen.getByRole("article").getAttribute("data-variant")).toBe("expanded");
  });

  it("becomes a disclosure when it can be opened", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<StoryCard story={STORY} onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: "The night-shift fix" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<StoryCard story={STORY} onToggle={onToggle} variant="expanded" />);
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("true");
  });
});
