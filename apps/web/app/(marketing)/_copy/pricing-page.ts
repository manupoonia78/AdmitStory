// /pricing (direction §5), verbatim where the direction gives the words. Sentence case, no "!",
// honest per spec §14.5.
//
// Deferrals (Manu, 2 Nov 2026): interview practice is "Coming soon" and is never shown as included;
// Phase 8 (expert mocks, the tracker, after decisions) isn't sold at launch, so the expert-mock
// plane and the "After decisions" ledger group are left out. There are no coupon or referral codes
// in the app yet, so the pricing questions don't mention them.

import { COMING_SOON, INTERVIEW_COMING_SOON_LINE } from "./shared";

export const PRICING_PAGE_COPY = {
  heading: "$100 per school.",
  phoneHeading: ["$100", "per school."],
  subline:
    "Everything one school asks for, built from what you’ve told us. Talking, your Profile Read and your school strategy are free.",
  kitLabel: "A sample kit preview for Northfield",
  positioningHeading: "Positioning",
  fileMapHeading: "Which story goes where",
  deliverablesHeading: "What Northfield asks for",
  unlockSwitch: "Show what unlocks",
  locked: "Locked",
} as const;

/** The ledger's two columns, and what each cell says in words. */
export const LEDGER_COPY = {
  heading: "What’s free, and what a kit adds.",
  caption: "What is free and what each school kit includes, grouped by stage",
  feature: "Feature",
  free: "Free",
  kit: "With a school kit",
  included: "Included",
  notIncluded: "—",
  comingSoon: COMING_SOON,
  /** Phones: one word per row instead of two columns. */
  phoneFree: "Free",
  phoneKit: "Per school",
} as const;

export type LedgerCell = "included" | "none" | "coming_soon";

export interface LedgerRow {
  feature: string;
  description: string;
  free: LedgerCell;
  kit: LedgerCell;
}

export interface LedgerGroup {
  id: string;
  name: string;
  rows: readonly LedgerRow[];
}

const free = (feature: string, description: string): LedgerRow => ({
  feature,
  description,
  free: "included",
  kit: "included",
});

const perSchool = (feature: string, description: string): LedgerRow => ({
  feature,
  description,
  free: "none",
  kit: "included",
});

export const LEDGER: readonly LedgerGroup[] = [
  {
    id: "before",
    name: "Before you choose schools",
    rows: [
      free("Story Studio", "By voice or typing. Upload a résumé and it asks only about the gaps."),
      free(
        "Story Bank and Fact Sheet",
        "Your stories and their facts, confirmed once and identical for every school.",
      ),
      free(
        "Profile Read",
        "How an admissions reader is likely to see you, across four lenses, with a plan to strengthen it.",
      ),
      free(
        "School Strategy",
        "Rounds and deadlines, the class profile against yours in words, and honest flags with sources.",
      ),
      free(
        "Kit previews",
        "For every school: the positioning, which story goes where, and each deliverable, locked.",
      ),
    ],
  },
  {
    id: "school",
    name: "For each school",
    rows: [
      perSchool(
        "Positioning and file map",
        "What this school must see, and the story that leads each answer.",
      ),
      perSchool(
        "Essays and short answers",
        "Every one the school asks for, with options and the reasons for each.",
      ),
      perSchool("Refinement", "Rework any draft until you’re happy with it, within fair use."),
      perSchool(
        "Checks across the whole file",
        "Facts, numbers and dates kept consistent from essay to form to résumé.",
      ),
      perSchool("Form advisor", "What to enter in each field of the school’s own form."),
      perSchool("Résumé pass", "Your résumé tightened for this school, with every change shown."),
      perSchool(
        "Recommender briefs",
        "A brief and a private page for each recommender. They write their own letter.",
      ),
    ],
  },
  {
    id: "interviews",
    name: "Interviews",
    rows: [
      {
        feature: "Interview plan and practice",
        description: INTERVIEW_COMING_SOON_LINE,
        free: "none",
        kit: "coming_soon",
      },
    ],
  },
];

export const REFUNDS_COPY = {
  heading: "Refunds and tax",
  paddle:
    "Payments are processed by Paddle, our merchant of record, which adds tax where it applies and issues your receipt.",
  noSubscription: "No subscription. You pay once per school, for that application cycle.",
} as const;

export const NO_CHARGE_COPY = {
  heading: "What we won’t charge for",
  line: "Talking to Story Studio, your Story Bank, your Profile Read, School Strategy and every kit preview are free, with no card needed.",
} as const;

export const PRICING_QUESTIONS_HEADING = "Pricing questions";

export interface PricingQuestion {
  id: string;
  question: string;
  answer: string;
}

export function pricingQuestions(refundRule: string): readonly PricingQuestion[] {
  return [
    { id: "refund", question: "Can I get a refund?", answer: refundRule },
    {
      id: "subscription",
      question: "Why not a subscription?",
      answer: "Applications have an end. You pay for the schools you apply to, once.",
    },
    {
      id: "where-to-buy",
      question: "Where do I pay?",
      answer:
        "Inside the app, from a school’s kit preview, once you’ve chosen the school and the round. Nothing on this page asks for a card.",
    },
    {
      id: "more-schools",
      question: "What if I apply to five schools?",
      answer:
        "Each school’s kit is $100. Your stories, facts and Profile Read carry over, so every new school starts from everything you’ve already said.",
    },
  ];
}
