// Builders for synthetic drafts. Every name, school and number here is invented.

import type { DraftDoc, DraftParagraph, DraftSentence, SentenceKind } from "../src/types";

export function s(
  text: string,
  kind: SentenceKind = "verbatim",
  sources: string[] = ["L001"],
): DraftSentence {
  return { text, kind, sources };
}

export function para(id: string, ...sentences: (string | DraftSentence)[]): DraftParagraph {
  return { id, sentences: sentences.map((x) => (typeof x === "string" ? s(x) : x)) };
}

export function doc(...paragraphs: DraftParagraph[]): DraftDoc {
  return { paragraphs };
}

/** Paragraphs split on blank lines, sentences after . ! or ?; every sentence verbatim from L001. */
export function fromText(text: string): DraftDoc {
  return {
    paragraphs: text
      .trim()
      .split(/\n\s*\n/)
      .map((block, i) => para(`p${i + 1}`, ...block.trim().split(/(?<=[.!?]["”]?)\s+/))),
  };
}
