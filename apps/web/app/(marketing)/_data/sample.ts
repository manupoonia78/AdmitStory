// The sample applicant (direction §4 overview): the Phase 0.5 one, a fictional hospital systems
// analyst writing for "Northfield", a fictional school. Wherever they appear, FICTIONAL_NOTE
// (../_copy/shared.ts) appears with them. The essay and its sources are copied from
// apps/web/app/prototype/workspace/essay.ts (the product never imports from a prototype); keep
// the L041 sentence identical to it.
//
// Server-safe: plain data and types only, so any island or server component may import it.

import type { VoiceprintIdentity } from "@admitstory/shared";
import type { DraftNeed, DraftParagraph, SourceExcerpts, StoryCardData } from "@admitstory/ui";

export const SAMPLE_SCHOOL = "Northfield";

/** The sentence that travels through the whole landing page: L041, verbatim. */
export const SAMPLE_LINE =
  "It was 2 a.m. and the feed from the lab system was dropping every fourth message.";

/** A fixed, warm, unhurried speaker. The hero poster and the OG image draw this form. */
export const SAMPLE_IDENTITY: VoiceprintIdentity = {
  version: 1,
  avgPitchHz: 176,
  paceWpm: 158,
  pitchRangeSemitones: 9,
  pauseRhythm: 0.34,
  source: "voice",
};

export const SAMPLE_STORY: StoryCardData = {
  id: "sample-night-shift-fix",
  nickname: "The night-shift fix",
  era: "2024",
  context: "Work",
  traits: ["Ownership", "Composure under pressure", "Bringing people together"],
  status: { tone: "verified", label: "Confirmed" },
  summary:
    "A go-live with no manager in place, a lab feed failing at 2 a.m., and a fix found by 4:40.",
};

/** Three facts the applicant confirmed in the Dossier (shown in the story frame). */
export const SAMPLE_FACTS = [
  "Go-live of the lab results feed, March 2024",
  "Fault found at 4:40 a.m.: a timeout left on test settings",
  "Runbook written that night, still in use",
] as const;

/** The phrase from the sentence that the story card shows in --voice. */
export const SAMPLE_PHRASE = "dropping every fourth message";

export const SAMPLE_PROMPT = {
  title: "Essay 1",
  text: "Tell us about a time you took responsibility for something that was not yours to fix. What changed because of you?",
  limit: 200,
} as const;

export const SAMPLE_PARAGRAPHS: readonly DraftParagraph[] = [
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

export const SAMPLE_SOURCES: SourceExcerpts = {
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
};

/** The one open question in the sample draft (the Workspace's need chip). */
export const SAMPLE_NEED: DraftNeed = {
  paragraph_id: "p3",
  after_sentence: 2,
  question: "What did your manager say when you told him?",
  approx_words: 20,
};

/** Where the sentence came from, as the Workspace's provenance plane says it. */
export const SAMPLE_PROVENANCE = "You said this in Story Studio, 14 Oct, 9:41 pm";

/** Story Studio's question that drew the sentence out (the Work chapter, prototype script). */
export const SAMPLE_QUESTION_STUDIO =
  "You led the go-live with no manager in place. What was the moment you were most worried it would fail?";

/**
 * An interview question that follows up on the essay. Interview practice is "Coming soon": show
 * it only as a labelled preview (plan OVERRIDE).
 */
export const SAMPLE_QUESTION_INTERVIEW =
  "You mentioned the go-live. What would you do differently now?";

/** The interviewer's calm, even form (silver), from the duet prototype. */
export const INTERVIEWER_IDENTITY: VoiceprintIdentity = {
  version: 1,
  avgPitchHz: 128,
  paceWpm: 150,
  pitchRangeSemitones: 5,
  pauseRhythm: 0.25,
  source: "default",
};
