// The landing page's sections below the pinned sequence (direction §4.4–4.10), verbatim where the
// direction gives the words. Sentence case, no "!", honest per spec §14.5.
//
// Deferrals (Manu, 2 Nov 2026): interview practice is "Coming soon" and is never listed as part of
// the kit; Phase 8 (expert mocks, the tracker) isn't sold at launch, so neither is mentioned here.

/** §4.4 How it works, in three lines. */
export const LINES_COPY = {
  heading: "Twenty minutes to a first draft.",
  paragraph:
    "That’s the fast path, if you upload a résumé and talk for twenty minutes. Most people come back for more, because the more you say, the more there is to choose from.",
  link: "See how it works",
  rows: [
    {
      step: "Talk, or bring your résumé and talk less.",
      sentence:
        "Story Studio interviews you about your life and work. Upload a résumé and it only asks about the gaps.",
      value: "20–45 min",
    },
    {
      step: "See how admissions will read you.",
      sentence:
        "A Profile Read and a school strategy, both free, with every number sourced and dated.",
      value: "Free",
    },
    {
      step: "Unlock a school.",
      sentence:
        "Positioning, every essay and short answer with options and reasons, the form, a résumé pass and your recommenders’ briefs.",
      value: "$100 per school",
    },
  ],
} as const;

/** §4.5 Real screens. */
export const SCREENS_COPY = {
  heading: "Quiet where you work.",
  paragraph:
    "The cinematic part ends at the door. Inside, AdmitStory is still, fast and keyboard-first, because nobody wants particles while cutting fourteen words at 1 a.m.",
  regionLabel: "App screens, scroll sideways",
  previous: "Previous",
  next: "Next",
} as const;

/** §4.6 Your words, lit. */
export const YOUR_WORDS_COPY = {
  heading: "See which words are yours.",
  paragraph:
    "Press Y, or flip the switch. Sentences that came from the applicant’s own words light up. Hover one to see when they said it.",
  phoneParagraph:
    "Flip the switch. Sentences that came from the applicant’s own words light up. Tap one to see when they said it.",
  sheetLabel: "A sample essay",
  sheetHeader: "Essay 1 · Northfield",
} as const;

/** §4.7 What it won't do. */
export const WONT_DO_COPY = {
  heading: "What it won’t do.",
  policyLine:
    "We check each school’s AI policy on its own website every cycle. Here’s what we have on file:",
  allPolicies: "See all schools’ AI policies",
} as const;

/** §4.8 Pricing. */
export const PRICING_COPY = {
  heading: "Pricing",
  seeKit: "See what’s in a kit",
  freeListLabel: "Included free",
  kitListLabel: "Included in each school kit",
} as const;

/** §4.10 The final call. */
export const FINAL_COPY = {
  heading: "Your story, told well, for each school.",
} as const;
