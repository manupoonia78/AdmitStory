// The sample kit preview on /pricing (direction §5): Northfield, the fictional school, for the
// fictional applicant in ../_data/sample.ts. Each deliverable's first two sentences are what "Show
// what unlocks" reveals; `own` marks the applicant's own words (lit in --voice-glow). Essay 1's
// opening is the landing page's sentence, verbatim; the other openings are the kit prototype's
// (apps/web/app/prototype/kit/script.ts). Plain data, safe for the client island.

import type { FileMapEntry } from "@admitstory/ui";
import { SAMPLE_PARAGRAPHS } from "../_data/sample";

export const POSITIONING = {
  headline:
    "An analyst who takes ownership before anyone hands it over, and wants hospital operations to run on systems instead of heroes.",
  support: [
    "Northfield needs to see ownership without a title. The night-shift fix shows it best, so it leads Essay 1.",
    "Lead with two traits: calm under pressure, and building things that last after you leave.",
  ],
} as const;

export interface UnlockSentence {
  text: string;
  /** The applicant's own words (verbatim or lightly adapted). */
  own: boolean;
}

export interface UnlockDeliverable {
  key: string;
  title: string;
  limit: string;
  story: string;
  /** The draft's first two sentences. */
  opening: readonly [UnlockSentence, UnlockSentence];
}

/** The first two sentences of the sample essay, so Essay 1 opens with the landing page's line. */
function essayOneOpening(): readonly [UnlockSentence, UnlockSentence] {
  const [first, second] = SAMPLE_PARAGRAPHS[0]?.sentences ?? [];
  if (!first || !second) throw new Error("The sample essay needs two opening sentences");
  return [
    { text: first.text, own: first.kind !== "composed" },
    { text: second.text, own: second.kind !== "composed" },
  ];
}

export const DELIVERABLES: readonly UnlockDeliverable[] = [
  {
    key: "essay-1",
    title: "Essay 1",
    limit: "200 words",
    story: "The night-shift fix",
    opening: essayOneOpening(),
  },
  {
    key: "essay-2",
    title: "Essay 2",
    limit: "300 words",
    story: "Eight people in a park",
    opening: [
      {
        text: "The first Saturday, eight people came to the park, and three of them were my cousins.",
        own: true,
      },
      { text: "By spring there were forty, and I had stopped counting.", own: false },
    ],
  },
  {
    key: "essay-3",
    title: "Essay 3",
    limit: "250 words",
    story: "The vendor who said no",
    opening: [
      {
        text: "Last year a vendor told me our hospital was too small to matter.",
        own: true,
      },
      { text: "I spent six weeks proving him wrong.", own: false },
    ],
  },
  {
    key: "short-1",
    title: "Short answer",
    limit: "50 words",
    story: "My grandmother’s ledger",
    opening: [
      {
        text: "I learned to keep accounts from my grandmother’s ledger before I could do long division.",
        own: false,
      },
      {
        text: "She wrote every sale in pencil, so mistakes could be fixed without being hidden.",
        own: true,
      },
    ],
  },
];

export const FILE_MAP: readonly FileMapEntry[] = [
  ...DELIVERABLES.map((d) => ({ key: d.key, deliverable: d.title, story: d.story })),
  { key: "form", deliverable: "Application form", story: null },
  { key: "resume", deliverable: "Résumé", story: null },
  { key: "recommenders", deliverable: "Recommender briefs", story: "The night-shift fix" },
];
