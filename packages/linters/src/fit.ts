// Fitting a short entry to a portal's limit without inventing anything (spec §5.10: "every
// rewritten entry fits its limit by the school's counting rule"). Only ever removes text: whole
// trailing sentences first, then trailing clauses, then trailing words (characters, for scripts
// without spaces). The model is asked to stay
// within the limit; this is the guarantee behind it.

import { count, graphemes } from "./count";
import type { LimitRule } from "./types";

export interface FitResult {
  text: string;
  /** True when anything was cut. */
  trimmed: boolean;
  /** The count after fitting, by the rule. */
  count: number;
}

const SENTENCES = /[^.!?…]+(?:[.!?…]+["”’)]*|$)\s*/gu;

function sentencesOf(text: string): string[] {
  return (text.match(SENTENCES) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

const fits = (text: string, rule: LimitRule) => count(text, rule.kind) <= rule.value;

/** Ends a cut fragment cleanly: no dangling comma, conjunction or article, and a full stop. */
function close(text: string): string {
  const cut = text
    .trim()
    .replace(/[\s,;:–—-]+$/u, "")
    .replace(/\s+(?:and|or|but|with|of|to|for|the|a|an|in|on|at|by)$/iu, "")
    .replace(/[\s,;:–—-]+$/u, "");
  return /[.!?…]["”’)]*$/u.test(cut) ? cut : `${cut}.`;
}

export function fitToLimit(text: string, rule: LimitRule | null): FitResult {
  const original = text.trim();
  if (!rule || fits(original, rule))
    return { text: original, trimmed: false, count: rule ? count(original, rule.kind) : 0 };

  // 1. Whole trailing sentences, keeping at least one.
  const sentences = sentencesOf(original);
  for (let n = sentences.length - 1; n >= 1; n -= 1) {
    const candidate = sentences.slice(0, n).join(" ");
    if (fits(candidate, rule))
      return { text: candidate, trimmed: true, count: count(candidate, rule.kind) };
  }

  // 2. Trailing clauses of the first sentence (at commas, semicolons and dashes).
  const first = sentences[0] ?? original;
  const clauses = first.split(/(?<=[,;:–—])\s+/u);
  for (let n = clauses.length - 1; n >= 1; n -= 1) {
    const candidate = close(clauses.slice(0, n).join(" "));
    if (fits(candidate, rule))
      return { text: candidate, trimmed: true, count: count(candidate, rule.kind) };
  }

  // 3. Trailing words.
  const words = first.split(/\s+/u);
  for (let n = words.length - 1; n >= 1; n -= 1) {
    const candidate = close(words.slice(0, n).join(" "));
    if (fits(candidate, rule))
      return { text: candidate, trimmed: true, count: count(candidate, rule.kind) };
  }

  // 4. Trailing characters, for scripts written without spaces (Japanese, Chinese, Thai).
  const chars = graphemes(first);
  for (let n = chars.length - 1; n >= 1; n -= 1) {
    const candidate = chars.slice(0, n).join("").trimEnd();
    if (fits(candidate, rule))
      return { text: candidate, trimmed: true, count: count(candidate, rule.kind) };
  }
  return { text: "", trimmed: true, count: 0 };
}
