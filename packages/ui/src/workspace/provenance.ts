// Provenance arithmetic for the your-words view (spec §8.7).

import { countWords } from "./sentences";
import type { DraftParagraph, DraftSentence } from "./types";

/** Verbatim and adapted sentences are the applicant's own words and glow; composed ones don't. */
export function isOwnWords(sentence: Pick<DraftSentence, "kind">): boolean {
  return sentence.kind === "verbatim" || sentence.kind === "adapted";
}

/** A paragraph as plain text, sentences joined by single spaces. */
export function paragraphText(paragraph: Pick<DraftParagraph, "sentences">): string {
  return paragraph.sentences.map((sentence) => sentence.text).join(" ");
}

/** The whole draft as plain text, paragraphs separated by blank lines. */
export function draftText(paragraphs: readonly Pick<DraftParagraph, "sentences">[]): string {
  return paragraphs.map(paragraphText).join("\n\n");
}

/**
 * Voice fidelity (spec §8.7): the share of draft words inside verbatim or adapted sentences,
 * 0..1. An empty draft scores 0.
 */
export function ownWordsShare(paragraphs: readonly Pick<DraftParagraph, "sentences">[]): number {
  let own = 0;
  let total = 0;
  for (const paragraph of paragraphs) {
    for (const sentence of paragraph.sentences) {
      const words = countWords(sentence.text);
      total += words;
      if (isOwnWords(sentence)) own += words;
    }
  }
  return total === 0 ? 0 : own / total;
}
