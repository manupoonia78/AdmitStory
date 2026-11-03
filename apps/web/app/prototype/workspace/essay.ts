// Fake data for the Workspace prototype (spec §5.8, §6.10 screen G): one essay for a fictional
// applicant (a hospital systems analyst) at a fictional school, in the Draft shape from spec
// Appendix I. Every lit sentence points at a source; composed sentences make no claim of their own.

import type { DraftNeed, DraftParagraph, DraftSentence, SourceExcerpts } from "@admitstory/ui";

export const SCHOOL_LABEL = "Northfield 2026–27";

export const PROMPT = {
  title: "Essay 1",
  text: "Tell us about a time you took responsibility for something that was not yours to fix. What changed because of you?",
  limit: 200,
} as const;

export const PARAGRAPHS: readonly DraftParagraph[] = [
  {
    id: "p1",
    sentences: [
      {
        text: "It was 2 a.m. and the feed from the lab system was dropping every fourth message.",
        kind: "verbatim",
        sources: ["L041"],
      },
      { text: "Nobody on the ward could see it yet, but I could.", kind: "composed", sources: [] },
      {
        text: "The go-live had been planned for months, and the manager who owned it had left two weeks before.",
        kind: "adapted",
        sources: ["C2"],
      },
    ],
  },
  {
    id: "p2",
    sentences: [
      {
        text: "I was a systems analyst with no authority over the vendor or the nurses.",
        kind: "adapted",
        sources: ["C3"],
      },
      {
        text: "What I did have was a phone list and a pot of terrible coffee.",
        kind: "verbatim",
        sources: ["L043"],
      },
      {
        text: "I called the vendor’s engineer, then woke the lab supervisor, and kept them both on one line until we found it.",
        kind: "composed",
        sources: [],
      },
    ],
  },
  {
    id: "p3",
    sentences: [
      {
        text: "We found it at 4:40: a timeout nobody had changed from the test settings.",
        kind: "verbatim",
        sources: ["L044"],
      },
      {
        text: "I wrote down every step we took, because I knew I would forget them by morning.",
        kind: "adapted",
        sources: ["C4"],
      },
      {
        text: "When my manager arrived at seven, I told him what had happened.",
        kind: "composed",
        sources: [],
      },
    ],
  },
  {
    id: "p4",
    sentences: [
      {
        text: "I learned that responsibility is not a title someone gives you.",
        kind: "composed",
        sources: [],
      },
      {
        text: "It is the moment you decide the problem is yours, and the hours you spend proving it.",
        kind: "adapted",
        sources: ["S03"],
      },
      {
        text: "I still keep that runbook, coffee stain and all.",
        kind: "verbatim",
        sources: ["L047"],
      },
      {
        text: "At Northfield, I want to learn to build teams that never need that call.",
        kind: "composed",
        sources: [],
      },
    ],
  },
];

export const NEEDS: readonly DraftNeed[] = [
  {
    paragraph_id: "p3",
    after_sentence: 2,
    question: "What did your manager say when you told him?",
    approx_words: 20,
  },
];

export const SOURCES: SourceExcerpts = {
  L041: {
    label: "Story Studio, session 2, 14 minutes in",
    quote:
      "It was 2 a.m. and the feed from the lab system was dropping every fourth message, and I just sat there counting them.",
  },
  C2: {
    label: "Story Studio, session 2, 16 minutes in",
    quote:
      "We’d planned the go-live for months, and then our manager left two weeks before, so it was sort of nobody’s.",
  },
  C3: {
    label: "Story Studio, session 2, 17 minutes in",
    quote: "I was just the analyst. I couldn’t tell the vendor or the nurses to do anything.",
  },
  L043: {
    label: "Story Studio, session 2, 18 minutes in",
    quote: "What I did have was a phone list and a pot of terrible coffee.",
  },
  L044: {
    label: "Story Studio, session 2, 21 minutes in",
    quote: "And we found it at 4:40: a timeout nobody had changed from the test settings.",
  },
  C4: {
    label: "Story Studio, session 2, 22 minutes in",
    quote: "I wrote down every step we took, because I knew I’d forget the whole thing by morning.",
  },
  S03: {
    label: "Your story: The night-shift fix",
    quote:
      "It became mine the moment I decided it was mine, and then I spent the whole night proving it.",
  },
  L047: {
    label: "Story Studio, session 3, 4 minutes in",
    quote: "I still keep that runbook, coffee stain and all.",
  },
  C5: {
    label: "Story Studio, session 2, 17 minutes in",
    quote:
      "I rang their on-call engineer at quarter past two, he was in another time zone, and I kept him and the lab supervisor on the line for two hours.",
  },
};

/** A prepared Refine result: one sentence of one paragraph rewritten (spec §8.6 patches). */
export interface PreparedRevision {
  /** The quick action that produces it (spec §5.8 Refine). */
  action: string;
  paragraphId: string;
  sentenceIndex: number;
  sentence: DraftSentence;
}

export const REVISIONS: readonly PreparedRevision[] = [
  {
    action: "More specific",
    paragraphId: "p2",
    sentenceIndex: 2,
    sentence: {
      text: "At 2:15 I called the vendor’s on-call engineer in another time zone, then woke the lab supervisor, and kept them both on one line for two hours.",
      kind: "adapted",
      sources: ["C5"],
    },
  },
  {
    action: "Warmer",
    paragraphId: "p1",
    sentenceIndex: 1,
    sentence: {
      text: "Upstairs, the nurses could not see it yet, but I could already picture the results arriving late for their patients.",
      kind: "composed",
      sources: [],
    },
  },
  {
    action: "Stronger ending",
    paragraphId: "p4",
    sentenceIndex: 3,
    sentence: {
      text: "At Northfield, I want to learn to build the kind of team that fixes the feed before anyone has to make that call.",
      kind: "composed",
      sources: [],
    },
  },
];

/** The paragraph with the revision applied, or null if it no longer applies. */
export function applyRevision(
  paragraph: DraftParagraph,
  revision: PreparedRevision,
): DraftParagraph | null {
  const current = paragraph.sentences[revision.sentenceIndex];
  if (!current || current.text === revision.sentence.text) return null;
  const sentences = [...paragraph.sentences];
  sentences[revision.sentenceIndex] = revision.sentence;
  return { ...paragraph, sentences };
}

/** Adds the applicant's answer to a NEED as a sentence in their own words, after its anchor. */
export function answerNeed(
  paragraph: DraftParagraph,
  need: DraftNeed,
  answer: string,
  sourceId: string,
): DraftParagraph {
  const trimmed = answer.trim().replace(/\s+/g, " ");
  const text = /[.!?…"”’]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
  const sentence: DraftSentence = {
    text: text.charAt(0).toUpperCase() + text.slice(1),
    kind: "verbatim",
    sources: [sourceId],
  };
  const sentences = [...paragraph.sentences];
  sentences.splice(need.after_sentence + 1, 0, sentence);
  return { ...paragraph, sentences };
}
