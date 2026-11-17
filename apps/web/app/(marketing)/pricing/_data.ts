// The sample kit on /pricing (SPEC §4.2, "One kit, opened"): Northfield, the fictional school,
// for the fictional applicant in ../_data/sample.ts. Each draft's first two sentences, with the
// applicant's own words marked. Essay 1 opens with the landing page's line, verbatim; the other
// openings are the kit prototype's (apps/web/app/prototype/kit/script.ts). Plain data.

import { SAMPLE_PARAGRAPHS } from "../_data/sample";

export interface KitSentence {
  text: string;
  /** The applicant's own words (verbatim or lightly adapted). */
  own: boolean;
}

export interface KitDraft {
  key: string;
  title: string;
  limit: string;
  story: string;
  /** Why the draft opens this way: the margin note. */
  note: string;
  opening: readonly [KitSentence, KitSentence];
}

/** The first two sentences of the sample essay, so Essay 1 opens with the landing page's line. */
function essayOneOpening(): readonly [KitSentence, KitSentence] {
  const [first, second] = SAMPLE_PARAGRAPHS[0]?.sentences ?? [];
  if (!first || !second) throw new Error("The sample essay needs two opening sentences");
  return [
    { text: first.text, own: first.kind !== "composed" },
    { text: second.text, own: second.kind !== "composed" },
  ];
}

export const KIT_DRAFTS: readonly KitDraft[] = [
  {
    key: "essay-1",
    title: "Essay 1",
    limit: "200 words",
    story: "The night-shift fix",
    note: "The prompt asks about responsibility, so the night comes first.",
    opening: essayOneOpening(),
  },
  {
    key: "essay-2",
    title: "Essay 2",
    limit: "300 words",
    story: "Eight people in a park",
    note: "Opens small on purpose: eight people, three of them family.",
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
    title: "Why Northfield",
    limit: "250 words",
    story: "The vendor who said no",
    note: "Your goal starts from a refusal, so the school can see the gap it fills.",
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
    note: "Fifty words: one image, and your line to close it.",
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
