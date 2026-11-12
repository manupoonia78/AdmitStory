// The landing page's sections below the pinned sequence (direction §4.4–4.10), verbatim where the
// direction gives the words. Sentence case, no "!", honest per spec §14.5.
//
// Deferrals (Manu, 2 Nov 2026): interview practice is "Coming soon" and is never listed as part of
// the kit; Phase 8 (expert mocks, the tracker) isn't sold at launch, so neither is mentioned here.

/**
 * §4.4 How it works, in three steps (redesigned 4 Nov 2026). Each step shows the thing it hands
 * you: a Studio transcript, a Profile Read, a school pack's file map. The sample applicant's
 * material, so FICTIONAL_NOTE goes with it.
 */
export const LINES_COPY = {
  eyebrow: "How it works",
  headingLines: ["Twenty minutes", "to a first draft."],
  paragraph:
    "That’s the fast path, if you upload a résumé and talk for twenty minutes. Most people come back for more, because the more you say, the more there is to choose from.",
  link: "See how it works",
  label: "Three steps",
  rows: [
    {
      n: "01",
      kicker: "Story Studio",
      step: "Talk, or bring your résumé and talk less.",
      sentence:
        "Story Studio interviews you about your life and work. Upload a résumé and it only asks about the gaps.",
      value: "20–45 min",
      rail: "Minute 0",
    },
    {
      n: "02",
      kicker: "Profile Read",
      step: "See how admissions will read you.",
      sentence:
        "A Profile Read and a school strategy, both free, with every number sourced and dated.",
      value: "Free",
      rail: "Minute 20",
    },
    {
      n: "03",
      kicker: "School pack",
      step: "Unlock a school.",
      sentence:
        "Positioning, every essay and short answer with options and reasons, the form, a résumé pass and your recommenders’ briefs.",
      value: "$100 per school",
      rail: "Minutes later",
    },
  ],
  /** Step 1's artifact: one exchange in the Studio. */
  transcript: {
    header: "Story Studio · Work",
    question: "Walk me through the night the lab feed broke. Where were you?",
    found: "Story found",
    story: "The night-shift fix",
  },
  /** Step 2's artifact: the first lines of a Profile Read. */
  read: {
    header: "Profile Read · first look",
    headline: "An analyst who steps in when nobody owns the problem.",
    strength: { label: "Lands", text: "Ownership under pressure, shown with a 2 a.m. fix" },
    doubt: { label: "Doubt", text: "Why an MBA now, and not a promotion?" },
    footer: "Every number sourced and dated",
  },
  /** Step 3's artifact: the pack's file map, every story placed. */
  pack: {
    header: "Northfield · school pack",
    files: [
      { what: "Essay 1", story: "The night-shift fix" },
      { what: "Goals", story: "Teams that never need the 2 a.m. call" },
      { what: "Application form", story: "Filled from your Fact Sheet" },
      { what: "Résumé pass", story: "Six lines rewritten" },
      { what: "Recommender briefs", story: "Two, one per recommender" },
    ],
    status: "Drafted",
  },
} as const;

/** §4.5 Real screens. */
export const SCREENS_COPY = {
  heading: "Quiet where you work.",
  paragraph:
    "The cinematic part ends at the door. Inside, AdmitStories is still, fast and keyboard-first, because nobody wants particles while cutting fourteen words at 1 a.m.",
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

/**
 * Connect (Manu, 4 Nov 2026): a school pack also connects you with people from that school.
 * The faces are illustrative (lib/connect/illustrative.ts); ILLUSTRATIVE_NOTE goes
 * with them.
 */
export const CONNECT_COPY = {
  eyebrow: "Connect · with every school pack",
  headingLines: ["Talk to people", "who’ve been there."],
  paragraph:
    "Unlock a school and we match you with its alumni, current students and admissions-committee readers who work with us. Message them in the app: ask what the place is really like, or have someone read your why-school before you send it.",
  points: [
    { figure: "Alumni", line: "What the degree did for their career, and what they’d do again" },
    { figure: "Students", line: "Classes, clubs and recruiting, as they are this year" },
    { figure: "Readers", line: "How an application lands on the committee’s desk" },
  ],
  link: "See what a school pack includes",
} as const;
