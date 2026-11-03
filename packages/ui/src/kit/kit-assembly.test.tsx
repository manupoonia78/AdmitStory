// @vitest-environment jsdom
import "../../test/dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_IDENTITY } from "../voiceprint";
import { GapQuestionsPlane } from "./gap-questions-plane";
import { KitAssembly } from "./kit-assembly";
import type { KitDeliverable, KitStage, KitStory } from "./types";

const STORIES: KitStory[] = [
  { id: "S01", title: "The night-shift fix", context: "Work, 2024" },
  { id: "S02", title: "Eight people in a park", context: "Community, 2021" },
];

const STAGES: KitStage[] = [
  { id: "positioning", label: "Positioning", status: "done", actionLabel: "Read it now" },
  {
    id: "essays",
    label: "Essays",
    status: "active",
    detail: "Drafting Essay 2 from your story about eight people in a park",
  },
  { id: "short", label: "Short answers", status: "waiting" },
];

const DELIVERABLES: KitDeliverable[] = [
  {
    key: "essay-1",
    title: "Essay 1",
    prompt: "Tell us about a time you took responsibility.",
    limit: "200 words",
    status: "ready",
    storyId: "S01",
    text: "It was 2 a.m. and the feed was failing. Nobody else could see it.",
  },
  {
    key: "essay-2",
    title: "Essay 2",
    prompt: "Describe a community you built.",
    limit: "300 words",
    status: "drafting",
    storyId: "S02",
    text: "The first Saturday, eight people came. The sec",
  },
  {
    key: "essay-3",
    title: "Essay 3",
    prompt: "Why Northfield, and why now?",
    limit: "200 words",
    status: "waiting",
    storyId: null,
    text: "",
  },
];

function renderAssembly(props: Partial<Parameters<typeof KitAssembly>[0]> = {}) {
  return render(
    <KitAssembly
      identity={DEFAULT_IDENTITY}
      stories={STORIES}
      deliverables={DELIVERABLES}
      stages={STAGES}
      deliverablesHeading="What Northfield asks for"
      {...props}
    />,
  );
}

describe("KitAssembly", () => {
  it("says which story went to which essay in text, without the threads", () => {
    renderAssembly();
    const list = screen.getByRole("region", { name: "What Northfield asks for" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]!.textContent).toContain("From your story The night-shift fix");
    expect(rows[1]!.textContent).toContain("From your story Eight people in a park");
    expect(rows[2]!.textContent).toContain("Choosing a story");
    // The threads are decoration only.
    expect(document.querySelector("svg[aria-hidden]")).not.toBeNull();
  });

  it("names the Voiceprint and lists the stories, lighting the ones in use", () => {
    renderAssembly();
    expect(screen.getByRole("img", { name: "Your Voiceprint" })).toBeTruthy();
    const stories = within(screen.getByRole("region", { name: "Your stories" })).getAllByRole(
      "listitem",
    );
    expect(stories.map((s) => s.hasAttribute("data-lit"))).toEqual([true, true]);
  });

  it("gives each deliverable a status in words and streams only whole sentences", () => {
    renderAssembly();
    const rows = within(
      screen.getByRole("region", { name: "What Northfield asks for" }),
    ).getAllByRole("listitem");
    expect(rows[0]!.textContent).toContain("Draft ready");
    expect(rows[1]!.textContent).toContain("Drafting");
    expect(rows[1]!.textContent).toContain("The first Saturday, eight people came.");
    expect(rows[1]!.textContent).not.toContain("The sec");
    expect(rows[2]!.textContent).toContain("Waiting");
  });

  it("lists stages with a status word each and offers finished output", () => {
    const onStageAction = vi.fn();
    renderAssembly({ onStageAction });
    expect(screen.getByText("Done:")).toBeTruthy();
    expect(screen.getByText("In progress:")).toBeTruthy();
    expect(screen.getByText("Waiting:")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Read it now: Positioning" }));
    expect(onStageAction).toHaveBeenCalledWith("positioning");
  });

  it("announces the active stage politely", () => {
    const { container } = renderAssembly();
    const live = container.querySelector("p.sr-only[aria-live='polite']");
    expect(live?.textContent).toBe(
      "Essays: Drafting Essay 2 from your story about eight people in a park",
    );
  });

  it("keeps draft streams quiet so several essays never talk over each other", () => {
    renderAssembly();
    const rows = within(
      screen.getByRole("region", { name: "What Northfield asks for" }),
    ).getAllByRole("listitem");
    for (const row of rows) expect(row.querySelector("[aria-live]")).toBeNull();
  });

  it("goes still at tier 1: threads fade in place instead of travelling", () => {
    const { container } = renderAssembly({ tier: 1 });
    expect(container.firstElementChild?.getAttribute("data-motion")).toBe("still");
    const full = renderAssembly({ tier: 3 });
    expect(full.container.firstElementChild?.getAttribute("data-motion")).toBe("full");
  });
});

describe("GapQuestionsPlane", () => {
  it("holds its place while checking, then offers three ways forward", () => {
    const onSkip = vi.fn();
    const { rerender } = render(<GapQuestionsPlane count={null} onSkip={onSkip} />);
    expect(
      screen.getByRole("heading", {
        name: "Checking whether the drafts need anything else from you.",
      }),
    ).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);

    rerender(<GapQuestionsPlane count={4} onSkip={onSkip} />);
    expect(
      screen.getByRole("region", {
        name: "While you wait: 4 quick questions would make these drafts stronger.",
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Answer by voice",
      "Type answers",
      "Skip, draft with gaps",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Skip, draft with gaps" }));
    expect(onSkip).toHaveBeenCalled();
  });

  it("shows its children in place of the choices once one is taken", () => {
    render(
      <GapQuestionsPlane count={1}>
        <p>Question 1 of 1</p>
      </GapQuestionsPlane>,
    );
    expect(screen.getByText("Question 1 of 1")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("heading").textContent).toBe(
      "While you wait: 1 quick question would make these drafts stronger.",
    );
  });
});
