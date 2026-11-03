// Portal counting (spec §5.8: "a live count that matches how that school's portal counts", and
// the AC "Live count equals the pack's counting rule for that prompt in tests across 20 sample
// texts"). The Workspace counter, the limit linter, the Short-form Writer's trim loop and "Copy
// for portal" all count with these functions, so the number the applicant sees is the number
// every check uses.
//
// WORDS. Portals overwhelmingly split on whitespace. We do the same, with three documented
// refinements, chosen so we never show fewer words than a portal could:
//   1. Em dashes, en dashes, figure dashes and horizontal bars split words: "word—word" is 2.
//      Whitespace-only portals count it as 1 and Google Docs as 2; counting 2 is the safe side.
//   2. Hyphens and apostrophes keep a word together: "13-person", "well-known" and "don't" are 1.
//   3. A piece with no letter, digit or emoji ("—", "...", a lone "&") is not a word.
// Numbers are words: "50+", "$1.2M", "1,200", "3.5%" and "2026" are 1 each. An emoji standing
// alone is a word. In Chinese and Japanese text, which has no spaces, each Han, Hiragana or
// Katakana character is 1 word (Microsoft Word's rule); a Latin run next to them ("MBA") is 1.
// Korean uses spaces between words, so it follows the whitespace rule.
//
// CHARACTERS count user-perceived characters (Unicode grapheme clusters, via Intl.Segmenter): an
// emoji, a ZWJ family sequence, a flag, an accented letter written as letter + combining mark, a
// curly quote and an em dash are each 1. A line break is 1 character (CRLF included) and counts
// as a space in the excl-spaces rule. Portals that count UTF-16 code units would count some emoji
// as 2; "Copy for portal" leaves emoji to the applicant, and the pack's per-prompt notes say when
// a portal is known to differ.

import type { LimitKind, LimitRule } from "./types";

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** User-perceived characters. */
export function graphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

const WORD_DASHES = /[‒–—―⸺⸻]/u;
const COUNTABLE = /[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
// CJK punctuation and full-width forms end a Latin run inside CJK text ("MBA，我" is 2 words).
const CJK_BREAK = /[　-〿＀-／：-＠［-｀｛-･]/u;
const WHITESPACE = /^\s+$/u;

function countPiece(piece: string): number {
  if (!COUNTABLE.test(piece)) return 0;
  if (!CJK_CHAR.test(piece)) return 1;
  let count = 0;
  let inRun = false;
  for (const g of graphemes(piece)) {
    if (CJK_CHAR.test(g)) {
      count += 1;
      inRun = false;
    } else if (COUNTABLE.test(g)) {
      if (!inRun) count += 1;
      inRun = true;
    } else if (CJK_BREAK.test(g)) {
      inRun = false;
    }
  }
  return count;
}

export function countWords(text: string): number {
  let n = 0;
  for (const token of text.split(/\s+/u)) {
    if (!token) continue;
    for (const piece of token.split(WORD_DASHES)) n += countPiece(piece);
  }
  return n;
}

export function countChars(text: string, includeSpaces: boolean): number {
  let n = 0;
  for (const g of graphemes(text)) if (includeSpaces || !WHITESPACE.test(g)) n += 1;
  return n;
}

export function count(text: string, kind: LimitKind): number {
  switch (kind) {
    case "words":
      return countWords(text);
    case "chars_incl_spaces":
      return countChars(text, true);
    case "chars_excl_spaces":
      return countChars(text, false);
  }
}

/**
 * The text "Copy for portal" puts on the clipboard (§5.8): curly quotes straightened, odd spaces
 * made plain, invisible characters removed, trailing spaces trimmed, line endings unified. Em
 * dashes and ellipses stay as typed: each is 1 character either way, and rewriting "…" as "..."
 * would add 2. Zero-width joiners stay, because emoji sequences depend on them.
 */
export function normalizeForPortal(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[  -   ]/g, " ")
    .replace(/[​⁠﻿]/g, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** The count of exactly what the applicant will paste. */
export function countAfterNormalize(text: string, kind: LimitKind): number {
  return count(normalizeForPortal(text), kind);
}

export interface LimitStatus {
  count: number;
  limit: number;
  /** Positive when over the limit. */
  over: number;
  /** count / limit. */
  ratio: number;
}

export function limitStatus(text: string, rule: LimitRule): LimitStatus {
  const n = countAfterNormalize(text, rule.kind);
  return {
    count: n,
    limit: rule.value,
    over: Math.max(0, n - rule.value),
    ratio: rule.value > 0 ? n / rule.value : 0,
  };
}

/** "words" or "characters", for copy. */
export function unitLabel(kind: LimitKind, n = 2): string {
  const unit = kind === "words" ? "word" : "character";
  return n === 1 ? unit : `${unit}s`;
}
