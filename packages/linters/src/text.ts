// Draft and text helpers shared by the linters.

import type { DraftDoc, DraftParagraph, Finding, FindingLocation, RuleId, Severity } from "./types";

export function paragraphText(paragraph: DraftParagraph): string {
  return paragraph.sentences.map((s) => s.text.trim()).join(" ");
}

/** The draft as plain text: sentences joined by a space, paragraphs by a blank line. */
export function draftText(draft: DraftDoc): string {
  return draft.paragraphs.map(paragraphText).join("\n\n");
}

export interface SentenceRef {
  paragraphId: string;
  /** Zero-based within the paragraph. */
  index: number;
  text: string;
  kind: DraftDoc["paragraphs"][number]["sentences"][number]["kind"];
  sources: string[];
}

export function sentencesOf(draft: DraftDoc): SentenceRef[] {
  return draft.paragraphs.flatMap((p) =>
    p.sentences.map((s, index) => ({ paragraphId: p.id, index, ...s })),
  );
}

/** Lowercase word tokens with straight apostrophes, for matching (not for counting). */
export function wordTokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) ?? []
  );
}

/** Text with quoted speech removed, so dialogue doesn't count as the applicant's narration. */
export function withoutQuotedSpeech(text: string): string {
  return text.replace(/"[^"]*"|“[^”]*”/g, " ");
}

export function at(paragraphId: string | null, sentence: number | null = null): FindingLocation {
  return { paragraph_id: paragraphId, sentence };
}

export function finding(
  rule_id: RuleId,
  severity: Severity,
  location: FindingLocation,
  explanation: string,
  fix_hint: string | null = null,
): Finding {
  return { rule_id, severity, location, explanation, fix_hint };
}

/** "Essay 1" for copy. */
export function labelOf(d: { key: string; label?: string }): string {
  return d.label ?? d.key;
}

/** A short quote of a sentence for explanations. */
export function excerpt(text: string, words = 8): string {
  const parts = text.trim().split(/\s+/);
  return parts.length <= words ? parts.join(" ") : `${parts.slice(0, words).join(" ")}…`;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary-aware, case-insensitive regex for a literal phrase. Boundaries are Unicode letters/digits. */
export function phraseRegExp(phrase: string, flags = "giu"): RegExp {
  const body = escapeRegExp(phrase.trim()).replace(/\s+/g, "\\s+").replace(/'/g, "['’]");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags);
}

export function codePrefix(code: string): string {
  return code.trim().charAt(0).toUpperCase();
}
