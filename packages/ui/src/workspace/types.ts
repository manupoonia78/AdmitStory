// Draft shapes the Workspace renders. They mirror the Draft schema in spec Appendix I (Sentence,
// Paragraph, Draft.needs), so Phase 4 can pass parsed model output straight through.

/** How a sentence relates to what the applicant said (spec §8.7). */
export type SentenceKind = "verbatim" | "adapted" | "composed";

export interface DraftSentence {
  text: string;
  kind: SentenceKind;
  /** Cite ids: "L041" golden line, "C2" conversation, "F12" fact, "S03" story… */
  sources: readonly string[];
}

export interface DraftParagraph {
  id: string;
  sentences: readonly DraftSentence[];
}

/** A missing real detail, shown as a chip where it belongs (spec §5.8 [NEED] chips). */
export interface DraftNeed {
  paragraph_id: string;
  /** Index of the sentence the chip follows, within its paragraph. */
  after_sentence: number;
  question: string;
  approx_words: number;
}

/** What a cite id points at, shown as "the moment you said it". */
export interface SourceExcerpt {
  /** Where and when, e.g. "Story Studio, session 2, 14 minutes in". */
  label: string;
  /** The original transcript line or fact, as said or written. */
  quote: string;
}

export type SourceExcerpts = Readonly<Record<string, SourceExcerpt>>;
