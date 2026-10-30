import { describe, expect, it } from "vitest";
import { diffRuns, diffSide, diffWords, tokenizeWords, type DiffToken } from "./diff";

const kinds = (tokens: DiffToken[]) => tokens.map((t) => `${t.kind[0]}:${t.text}`);

describe("tokenizeWords", () => {
  it("splits on any whitespace and drops empties", () => {
    expect(tokenizeWords("  I called\nthe  vendor. ")).toEqual(["I", "called", "the", "vendor."]);
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("diffWords", () => {
  it("marks every word the same when nothing changed", () => {
    const tokens = diffWords("I called the vendor.", "I called the vendor.");
    expect(tokens.every((t) => t.kind === "same")).toBe(true);
    expect(tokens.map((t) => t.key)).toEqual(["b0", "b1", "b2", "b3"]);
  });

  it("finds a replaced word, removed before added", () => {
    expect(kinds(diffWords("I called the vendor.", "I phoned the vendor."))).toEqual([
      "s:I",
      "r:called",
      "a:phoned",
      "s:the",
      "s:vendor.",
    ]);
  });

  it("finds insertions and deletions at the start, middle and end", () => {
    expect(kinds(diffWords("the vendor", "at 2:15 the vendor's engineer"))).toEqual([
      "a:at",
      "a:2:15",
      "s:the",
      "r:vendor",
      "a:vendor's",
      "a:engineer",
    ]);
    expect(kinds(diffWords("so I stayed up late", "I stayed"))).toEqual([
      "r:so",
      "s:I",
      "s:stayed",
      "r:up",
      "r:late",
    ]);
  });

  it("keeps the longest run of shared words in place", () => {
    const before = "I called the vendor, then woke the lab supervisor.";
    const after = "At 2:15 I called the vendor's engineer, then woke the lab supervisor.";
    const tokens = diffWords(before, after);
    expect(kinds(tokens)).toEqual([
      "a:At",
      "a:2:15",
      "s:I",
      "s:called",
      "s:the",
      "r:vendor,",
      "a:vendor's",
      "a:engineer,",
      "s:then",
      "s:woke",
      "s:the",
      "s:lab",
      "s:supervisor.",
    ]);
  });

  it("handles empty sides", () => {
    expect(kinds(diffWords("", "New words"))).toEqual(["a:New", "a:words"]);
    expect(kinds(diffWords("Old words", ""))).toEqual(["r:Old", "r:words"]);
    expect(diffWords("", "")).toEqual([]);
  });

  it("gives every token a unique key tied to its side", () => {
    const tokens = diffWords("a b c d e", "a x c y e z");
    const keys = tokens.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const token of tokens) {
      expect(token.key.startsWith(token.kind === "added" ? "a" : "b")).toBe(true);
    }
  });

  it("round-trips: each side of the diff reads back as that version", () => {
    const cases = [
      ["I was a systems analyst with no authority.", "I was the only analyst on shift."],
      ["one two three four", "four three two one"],
      ["same same same", "same different same same"],
      ["", "only new"],
    ] as const;
    for (const [before, after] of cases) {
      const tokens = diffWords(before, after);
      expect(diffSide(tokens, "before")).toBe(tokenizeWords(before).join(" "));
      expect(diffSide(tokens, "after")).toBe(tokenizeWords(after).join(" "));
    }
  });

  it("is minimal: kept words are a longest common subsequence", () => {
    const tokens = diffWords("a b c a b b a", "c b a b a c");
    // The LCS of these two sequences has length 4.
    expect(tokens.filter((t) => t.kind === "same")).toHaveLength(4);
  });
});

describe("diffRuns", () => {
  it("joins neighbouring words of the same kind", () => {
    const runs = diffRuns(
      diffWords("I called the vendor today.", "I phoned the vendor's engineer today."),
    );
    expect(runs).toEqual([
      { kind: "same", text: "I" },
      { kind: "removed", text: "called" },
      { kind: "added", text: "phoned" },
      { kind: "same", text: "the" },
      { kind: "removed", text: "vendor" },
      { kind: "added", text: "vendor's engineer" },
      { kind: "same", text: "today." },
    ]);
  });
});
