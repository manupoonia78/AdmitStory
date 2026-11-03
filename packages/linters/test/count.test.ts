import { describe, expect, it } from "vitest";
import { count, countAfterNormalize, limitStatus, normalizeForPortal } from "../src/count";

// §5.8 AC: the live count equals the pack's counting rule across 20+ sample texts, including
// emoji, em dashes and curly quotes. Each expected value is counted by hand.
const SAMPLES: { name: string; text: string; words: number; incl: number; excl: number }[] = [
  {
    name: "plain sentence",
    text: "Six schools before I was fourteen.",
    words: 6,
    incl: 34,
    excl: 29,
  },
  { name: "empty", text: "", words: 0, incl: 0, excl: 0 },
  { name: "em dash joining words", text: "word—word", words: 2, incl: 9, excl: 9 },
  { name: "spaced em dash", text: "word — word", words: 2, incl: 11, excl: 9 },
  { name: "spaced en dash", text: "A – B", words: 2, incl: 5, excl: 3 },
  { name: "hyphenated number compound", text: "a 13-person team", words: 3, incl: 16, excl: 14 },
  { name: "hyphen and apostrophe", text: "well-known, don't stop", words: 3, incl: 22, excl: 20 },
  { name: "curly double quotes", text: "“Curly quotes” here", words: 3, incl: 19, excl: 17 },
  { name: "curly apostrophe", text: "It’s fine", words: 2, incl: 9, excl: 8 },
  { name: "single emoji", text: "🎉", words: 1, incl: 1, excl: 1 },
  { name: "ZWJ family emoji", text: "Family: 👨‍👩‍👧‍👦 forever", words: 3, incl: 17, excl: 15 },
  { name: "flag emoji", text: "🇮🇳 flag", words: 2, incl: 6, excl: 5 },
  { name: "skin-tone emoji", text: "👍🏽 done", words: 2, incl: 6, excl: 5 },
  { name: "combining accent", text: "Café", words: 1, incl: 4, excl: 4 },
  { name: "precomposed accents", text: "naïve résumé", words: 2, incl: 12, excl: 11 },
  { name: "Chinese", text: "我爱北京", words: 4, incl: 4, excl: 4 },
  { name: "Chinese with a Latin run", text: "我在MBA项目", words: 5, incl: 7, excl: 7 },
  { name: "Japanese kana and kanji", text: "日本語のテキスト", words: 8, incl: 8, excl: 8 },
  { name: "Korean uses spaces", text: "한국어 텍스트", words: 2, incl: 7, excl: 6 },
  {
    name: "numbers, money, plus",
    text: "50+ engineers across $1.2M of spend",
    words: 6,
    incl: 35,
    excl: 30,
  },
  { name: "year as a word", text: "2026 was the year", words: 4, incl: 17, excl: 14 },
  { name: "ellipsis", text: "Wait... what?", words: 2, incl: 13, excl: 12 },
  { name: "unicode ellipsis", text: "Wait… what?", words: 2, incl: 11, excl: 10 },
  { name: "punctuation-only tokens", text: "& and —", words: 1, incl: 7, excl: 5 },
  { name: "newline", text: "Line one.\nLine two.", words: 4, incl: 19, excl: 16 },
  { name: "CRLF is one character", text: "Line one.\r\nLine two.", words: 4, incl: 19, excl: 16 },
  { name: "non-breaking space", text: "non breaking space", words: 3, incl: 18, excl: 16 },
  {
    name: "tabs and double spaces",
    text: "Tabs\tand  double  spaces",
    words: 4,
    incl: 24,
    excl: 19,
  },
];

describe("portal counting (§5.8)", () => {
  it("has at least 20 hand-counted samples", () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(20);
  });

  for (const sample of SAMPLES) {
    it(`counts ${sample.name}`, () => {
      expect(count(sample.text, "words")).toBe(sample.words);
      expect(count(sample.text, "chars_incl_spaces")).toBe(sample.incl);
      expect(count(sample.text, "chars_excl_spaces")).toBe(sample.excl);
    });
  }
});

describe("normalizeForPortal", () => {
  it("straightens curly quotes and apostrophes", () => {
    expect(normalizeForPortal("“Hi,” she said. ‘It’s late.’")).toBe(`"Hi," she said. 'It's late.'`);
  });

  it("turns odd spaces into plain ones, removes zero-width spaces and trims line ends", () => {
    expect(normalizeForPortal("a b c  \n​d\t\r\ne  ")).toBe("a b c\nd\ne");
  });

  it("keeps emoji sequences, em dashes and ellipses intact", () => {
    const text = "Family 👨‍👩‍👧 — always…";
    expect(normalizeForPortal(text)).toBe(text);
  });

  it("counts what will be pasted", () => {
    expect(countAfterNormalize("  “Hello”  \n", "chars_incl_spaces")).toBe(7);
    expect(countAfterNormalize("one two", "words")).toBe(2);
  });
});

describe("limitStatus", () => {
  it("reports how far over the limit a text is", () => {
    expect(limitStatus("one two three four five", { kind: "words", value: 3 })).toEqual({
      count: 5,
      limit: 3,
      over: 2,
      ratio: 5 / 3,
    });
  });

  it("is not over at exactly the limit", () => {
    expect(limitStatus("abc de", { kind: "chars_excl_spaces", value: 5 }).over).toBe(0);
  });
});
