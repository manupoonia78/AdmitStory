import { describe, expect, it } from "vitest";
import { countCharacters, countWords, splitSentences, streamedSentences } from "./sentences";

describe("splitSentences", () => {
  it("splits on terminal punctuation followed by a capital or digit", () => {
    expect(splitSentences("I called the vendor. Nobody answered! Why? 4:40 was the time.")).toEqual(
      ["I called the vendor.", "Nobody answered!", "Why?", "4:40 was the time."],
    );
  });

  it("keeps a.m. and p.m. inside a sentence unless a new one starts", () => {
    expect(splitSentences("It was 2 a.m. and the feed was dropping.")).toEqual([
      "It was 2 a.m. and the feed was dropping.",
    ]);
    expect(splitSentences("It was 2 a.m. The feed was dropping.")).toEqual([
      "It was 2 a.m.",
      "The feed was dropping.",
    ]);
  });

  it("never ends a sentence on a title, an initial or e.g.", () => {
    expect(splitSentences("I asked Dr. Osei. She agreed.")).toEqual([
      "I asked Dr. Osei.",
      "She agreed.",
    ]);
    expect(splitSentences("Read J. K. Lane on teams. Then act.")).toEqual([
      "Read J. K. Lane on teams.",
      "Then act.",
    ]);
    expect(splitSentences("Some tools, e.g. Excel, broke.")).toEqual([
      "Some tools, e.g. Excel, broke.",
    ]);
  });

  it("keeps closing quotes and brackets with their sentence", () => {
    expect(splitSentences("He said, “Fix it.” Then he left. (I stayed.) We won.")).toEqual([
      "He said, “Fix it.”",
      "Then he left.",
      "(I stayed.)",
      "We won.",
    ]);
  });

  it("handles ellipses, line breaks and stray whitespace", () => {
    expect(splitSentences("  I waited… Nothing.\nThen a call.  ")).toEqual([
      "I waited…",
      "Nothing.",
      "Then a call.",
    ]);
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("leaves decimals and lowercase continuations alone", () => {
    expect(splitSentences("Errors fell 2.5 times. good enough.")).toEqual([
      "Errors fell 2.5 times. good enough.",
    ]);
  });
});

describe("streamedSentences", () => {
  it("holds the last sentence back until the next one starts", () => {
    expect(streamedSentences("It was 2 a.m.")).toEqual({ complete: [], pending: "It was 2 a.m." });
    expect(streamedSentences("It was 2 a.m. and")).toEqual({
      complete: [],
      pending: "It was 2 a.m. and",
    });
    expect(streamedSentences("It was late. The fe")).toEqual({
      complete: ["It was late."],
      pending: "The fe",
    });
  });

  it("releases everything once the stream is done", () => {
    expect(streamedSentences("It was late. The feed dropped.", true)).toEqual({
      complete: ["It was late.", "The feed dropped."],
      pending: "",
    });
    expect(streamedSentences("", true)).toEqual({ complete: [], pending: "" });
  });

  it("only ever appends: an earlier complete list is a prefix of a later one", () => {
    const text = "It was 2 a.m. and the feed failed. I called Dr. Osei. She came. We fixed it.";
    let previous: string[] = [];
    for (let end = 0; end <= text.length; end += 1) {
      const { complete } = streamedSentences(text.slice(0, end), end === text.length);
      expect(complete.slice(0, previous.length)).toEqual(previous);
      previous = complete;
    }
    expect(previous).toHaveLength(4);
  });
});

describe("countWords", () => {
  it("counts runs of non-space characters that hold a letter or digit", () => {
    expect(countWords("The night-shift fix — and 4:40 a.m.")).toBe(6);
    expect(countWords("“Fix it,” he said.")).toBe(4);
    expect(countWords("fix—and then")).toBe(2);
    expect(countWords("   ")).toBe(0);
    expect(countWords("Café déjà vu 👍")).toBe(3);
  });
});

describe("countCharacters", () => {
  it("counts what people see as one character, with or without spaces", () => {
    expect(countCharacters("abc de")).toBe(6);
    expect(countCharacters("abc de", { spaces: false })).toBe(5);
    expect(countCharacters("👍🏽 é")).toBe(3);
  });
});
