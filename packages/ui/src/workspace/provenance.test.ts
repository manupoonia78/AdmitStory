import { describe, expect, it } from "vitest";
import { draftText, isOwnWords, ownWordsShare, paragraphText } from "./provenance";
import type { DraftParagraph } from "./types";

const PARAGRAPHS: DraftParagraph[] = [
  {
    id: "p1",
    sentences: [
      { text: "It was 2 a.m. and the feed was failing.", kind: "verbatim", sources: ["L041"] },
      { text: "Nobody else could see it.", kind: "composed", sources: [] },
    ],
  },
  {
    id: "p2",
    sentences: [{ text: "I kept both of them on one line.", kind: "adapted", sources: ["C2"] }],
  },
];

describe("provenance", () => {
  it("treats verbatim and adapted sentences as the applicant's own words", () => {
    expect(isOwnWords({ kind: "verbatim" })).toBe(true);
    expect(isOwnWords({ kind: "adapted" })).toBe(true);
    expect(isOwnWords({ kind: "composed" })).toBe(false);
  });

  it("joins sentences with spaces and paragraphs with blank lines", () => {
    expect(paragraphText(PARAGRAPHS[0]!)).toBe(
      "It was 2 a.m. and the feed was failing. Nobody else could see it.",
    );
    expect(draftText(PARAGRAPHS).split("\n\n")).toHaveLength(2);
  });

  it("scores voice fidelity as the share of words in own-word sentences", () => {
    // 9 verbatim + 8 adapted own words out of 9 + 5 + 8 = 22.
    expect(ownWordsShare(PARAGRAPHS)).toBeCloseTo(17 / 22);
    expect(ownWordsShare([])).toBe(0);
  });
});
