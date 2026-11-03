import { describe, expect, it } from "vitest";
import { FICTIONAL_SCHOOL, STORIES, getStory, storyTransitionName } from "./stories";

describe("prototype stories", () => {
  it("have unique ids that work as URL segments and view transition names", () => {
    const ids = STORIES.map((story) => story.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(storyTransitionName("night-shift-fix", "title")).toBe("story-night-shift-fix-title");
  });

  it("follow the microcopy rules: sentence case, no exclamation marks", () => {
    for (const story of STORIES) {
      const text = [story.title, story.line, story.situation, story.action, story.result].join(" ");
      expect(text).not.toContain("!");
      // Sentence case: only the first word of a title is capitalised ("I" aside).
      const [, ...rest] = story.title.split(" ");
      for (const word of rest)
        expect(word === "I" || word[0] === word[0]?.toLowerCase()).toBe(true);
    }
  });

  it("only use the fictional school", () => {
    for (const story of STORIES) expect(story.usedIn.startsWith(FICTIONAL_SCHOOL)).toBe(true);
  });

  it("are found by id", () => {
    expect(getStory("eight-people-in-a-park")?.title).toBe("Eight people in a park");
    expect(getStory("missing")).toBeUndefined();
  });
});
