// /how-it-works (SPEC §4.2), the full telling of the landing page's four steps. Sentence case, no
// "!", honest per spec §14.5. The old page's eight steps are all kept, two to a stage.
//
// Deferrals (Manu, 2 Nov 2026): interview practice carries "Coming soon" and the promise line,
// never "In your kit"; there's no expert mock (Phase 8 isn't sold at launch).
//
// The sample kit below is the hospital systems analyst's (../_data/sample.ts), fictional, as is
// Northfield. Its prompts are invented for Northfield; no real school's prompt is quoted.

import { KIT_PRICE_DISPLAY } from "../_data/pricing";
import { INTERVIEW_COMING_SOON_LINE } from "./shared";

export const HOW_PAGE_COPY = {
  eyebrow: "How it works, in full",
  headingLines: ["From one conversation", "to every school."],
  paragraph:
    "Four stages, the first two free. You talk once; every school after that starts from everything you’ve already said.",
  indexLabel: "The four stages",
  interviewHeading: "Practise the interview.",
  interviewLine: INTERVIEW_COMING_SOON_LINE,
  policies: {
    eyebrow: "On the record",
    headingLines: ["Each school’s", "AI policy."],
    paragraph:
      "We check each school’s AI policy on its own website every cycle, and follow it when drafting. Where a school doesn’t allow AI-written answers, AdmitStories coaches instead of writing.",
    caption:
      "Schools’ AI policies, as published on each school’s website, with the date we checked",
    school: "School",
    policy: "Policy",
    mode: "What AdmitStories does",
    checked: "Checked",
    source: "Policy",
  },
} as const;

export interface HowDetail {
  heading: string;
  body: string;
  /** What it takes, right-aligned in mono: a time, "Free", "In your kit". */
  value: string;
}

export interface HowStage {
  id: "tell" | "position" | "draft" | "refine";
  verb: string;
  /** In the index under the verb. */
  cost: string;
  /** The pill under the stage's title. */
  pill: string;
  details: readonly [HowDetail, HowDetail];
}

export const HOW_STAGES: readonly HowStage[] = [
  {
    id: "tell",
    verb: "Tell",
    cost: "Free · 20 to 90 minutes",
    pill: "Free",
    details: [
      {
        heading: "Tell your story.",
        body: "Story Studio interviews you by voice or typing, across nine chapters of your life and work. Choose an express, standard or deep session, and upload a résumé to skip what’s already on it.",
        value: "20–90 min",
      },
      {
        heading: "Check your facts once.",
        body: "The Dossier holds your stories with their facts. You confirm the numbers once, and the fact sheet stays identical across every school.",
        value: "Free",
      },
    ],
  },
  {
    id: "position",
    verb: "Position",
    cost: "Free",
    pill: "Free",
    details: [
      {
        heading: "See how you’ll be read.",
        body: "The Profile Read looks at your file through four lenses an admissions reader uses, then gives you a plan to strengthen it. No scores out of 100.",
        value: "Free",
      },
      {
        heading: "Choose schools and rounds.",
        body: "School Strategy lays out deadlines and rounds, compares the class profile with yours in words, and flags what matters, with the source for each.",
        value: "Free",
      },
    ],
  },
  {
    id: "draft",
    verb: "Draft",
    cost: `${KIT_PRICE_DISPLAY} a school, or less in a pack`,
    pill: "With a school pack",
    details: [
      {
        heading: "Unlock a school.",
        body: "The kit builds that school’s positioning and file map, every essay and short answer with options and reasons, the form and your résumé.",
        value: "A few minutes",
      },
      {
        heading: "Brief your recommenders.",
        body: "Each recommender gets a brief and a private page with the stories worth telling. They write their own letter.",
        value: "In your kit",
      },
    ],
  },
  {
    id: "refine",
    verb: "Refine",
    cost: "In your kit",
    pill: "With a school pack",
    details: [
      {
        heading: "Make each draft yours.",
        body: "Your own words are marked, it asks you questions instead of guessing, and it checks facts, numbers and dates across the whole file as you refine.",
        value: "In your kit",
      },
      {
        heading: "See exactly what changed.",
        body: "Every revision comes back as a diff you keep or undo. Ask for a cut, another story or a new angle; nothing is rewritten behind your back.",
        value: "In your kit",
      },
    ],
  },
];

/** The pack assembling (inside the Draft stage): which story feeds which file. */
export const PACK_MAP_COPY = {
  label: "A sample kit · Northfield",
  heading: "Which story goes where",
  storiesLabel: "Your stories",
  filesLabel: "What Northfield asks for",
  heldBack: "Held back",
  from: "From",
  caption:
    "A sample kit for Northfield: five stories and the fact sheet on the left, eight files on the right, and a line from each story to the files it feeds. One story is held back for another school.",
  note: "A sample applicant · fictional, as is Northfield",
} as const;

export interface PackStory {
  id: string;
  title: string;
  context: string;
}

export interface PackFile {
  id: string;
  title: string;
  limit: string;
  /** The story that feeds it. */
  from: string;
}

export const PACK_STORIES: readonly PackStory[] = [
  { id: "night", title: "The night-shift fix", context: "Work · 2024" },
  { id: "park", title: "Eight people in a park", context: "Community · 2021" },
  { id: "vendor", title: "The vendor who said no", context: "Work · 2023" },
  { id: "ledger", title: "My grandmother’s ledger", context: "Home · 2006" },
  { id: "warning", title: "The warning on my record", context: "Work · 2019" },
  { id: "facts", title: "Your fact sheet", context: "Confirmed once" },
];

/** In story order, so the threads cross as little as they can. */
export const PACK_FILES: readonly PackFile[] = [
  { id: "essay-1", title: "Essay 1", limit: "200 words", from: "night" },
  { id: "briefs", title: "Recommender briefs", limit: "Two", from: "night" },
  { id: "essay-2", title: "Essay 2", limit: "300 words", from: "park" },
  { id: "essay-3", title: "Why Northfield", limit: "250 words", from: "vendor" },
  { id: "goal", title: "Goal statement", limit: "150 characters", from: "vendor" },
  { id: "short", title: "Short answer", limit: "50 words", from: "ledger" },
  { id: "form", title: "Application form", limit: "Every field", from: "facts" },
  { id: "resume", title: "Résumé", limit: "One page", from: "facts" },
];

/** The story with no thread: not every story suits every school. */
export const PACK_HELD_BACK = "warning";
