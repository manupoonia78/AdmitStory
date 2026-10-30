import { describe, expect, it } from "vitest";
import {
  BASE_FACTS,
  CHAPTERS,
  NIGHT_SHIFT_FIX,
  SAMPLE_ANSWER,
  SHELF,
  STORY_FACTS,
  coverageFor,
} from "./script";

describe("Studio prototype script", () => {
  it("has the nine chapters of spec §5.2, in order", () => {
    expect(CHAPTERS.map((c) => c.label)).toEqual([
      "Roots",
      "Education",
      "Work",
      "Beyond work",
      "Turning points",
      "People and values",
      "Goals",
      "Schools",
      "Recommenders",
    ]);
  });

  it("opens Roots on the spec's first question", () => {
    expect(CHAPTERS[0]?.question).toBe(
      "Let's start before your first job. Where did you grow up, and what was home like?",
    );
  });

  it("ends the sample at 9 stories and 61 facts, as in the spec's wireframe", () => {
    expect(SHELF.length + 1).toBe(9);
    expect(BASE_FACTS + STORY_FACTS).toBe(61);
    expect(SHELF.some((story) => story.id === NIGHT_SHIFT_FIX.id)).toBe(false);
    expect(SAMPLE_ANSWER.filter((segment) => segment.story)).toHaveLength(1);
  });

  it("keeps questions to two sentences and copy free of exclamation marks", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.question.match(/[.?]/g)?.length ?? 0).toBeLessThanOrEqual(2);
      expect(chapter.question).not.toMatch(/!/);
    }
    for (const segment of SAMPLE_ANSWER) expect(segment.text).not.toMatch(/!/);
  });

  it("covers all six lenses, and the story lifts leadership", () => {
    const before = coverageFor(false);
    const after = coverageFor(true);
    expect(before.map((lens) => lens.id)).toEqual([
      "academics",
      "self-awareness",
      "employability",
      "leadership",
      "goals",
      "school-fit",
    ]);
    expect(before.find((lens) => lens.id === "leadership")?.level).toBe("partial");
    expect(after.find((lens) => lens.id === "leadership")?.level).toBe("strong");
  });
});
