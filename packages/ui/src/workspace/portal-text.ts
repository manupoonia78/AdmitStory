// "Copy for portal" (spec §5.8 Export): the draft as plain text that pastes cleanly into an
// application portal, and its count by the school's own rule, checked on exactly what is copied.

import { countCharacters, countWords } from "./sentences";

/** How a prompt's limit is counted, set per prompt in the pack (spec §5.8). */
export interface CountRule {
  unit: "words" | "characters";
  limit: number;
  /** Characters only: whether spaces count. Default true. */
  spaces?: boolean;
}

/**
 * Plain text for a portal: curly quotes and apostrophes straightened (portals often mangle them),
 * non-breaking and odd spaces made plain, line endings unified, trailing spaces trimmed, and
 * paragraphs separated by one blank line. Dashes and accents are left as written.
 */
export function portalText(text: string): string {
  return text
    .replace(/\r\n?/gu, "\n")
    .replace(/[“”„‟″]/gu, '"')
    .replace(/[‘’‚‛′]/gu, "'")
    .replace(/[     ]/gu, " ")
    .replace(/[​﻿]/gu, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

/** The count of `text` under the prompt's rule. */
export function countFor(text: string, rule: CountRule): number {
  return rule.unit === "words"
    ? countWords(text)
    : countCharacters(text, { spaces: rule.spaces ?? true });
}

/** "200 words", "300 characters", "300 characters without spaces". */
export function ruleLabel(rule: CountRule): string {
  if (rule.unit === "words") return `${rule.limit} words`;
  return rule.spaces === false
    ? `${rule.limit} characters without spaces`
    : `${rule.limit} characters`;
}
