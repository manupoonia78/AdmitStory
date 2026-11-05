// /terms (direction §8): plain terms that encode the integrity rules (spec §14.7). A structured
// draft for counsel, not legal advice. Prices and the final-sale rule come from _data/pricing.ts and
// ./shared.ts verbatim, so the terms can't drift from what the pricing page says.
//
// Launch scope (Manu, 2 Nov 2026): expert sessions (Phase 8) aren't sold, so their section from the
// direction (45 minutes, priced per expert, free to reschedule or cancel up to 24 h before, no-shows
// charged) is left out until they are. Section 10 is placeholders for counsel.

import type { LegalSection } from "../_legal/legal-types";
import { KIT_PRICE_DISPLAY, PLAN_CARDS } from "../_data/pricing";
import { HELLO_EMAIL, LEGAL_ENTITY } from "./chrome";
import { SALES_FINAL_RULE } from "./shared";

const PACKS = PLAN_CARDS.filter((plan) => plan.was !== null)
  .map((plan) => `${plan.name} for ${plan.price}`)
  .join(" or ");

/** TODO(Manu): counsel fills these in before launch. */
export const GOVERNING_LAW = "TODO(Manu): governing law and courts, from counsel";
export const LIABILITY_TERMS = "TODO(Manu): limitation of liability, from counsel";

export const TERMS_COPY = {
  title: "Terms.",
  contents: "On this page",
} as const;

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    id: "who-can-use-it",
    title: "Who can use it",
    summary: "You must be 18 or older, and an account is for one person.",
    body: [
      `These terms are between you and ${LEGAL_ENTITY}. By creating an account you agree to them.`,
      "You must be 18 or older. Your account is for you alone: don't share it, and don't use it to prepare someone else's application.",
    ],
  },
  {
    id: "your-story-must-be-true",
    title: "Your story must be true",
    summary:
      "You confirm that everything you tell us, and everything you submit, describes your own experiences truthfully.",
    body: [
      "AdmitStories drafts from what you tell it and never invents a story, a number or a quote. That only works if what you tell it is true.",
      "You're responsible for checking every draft before you use it, and for everything you submit to a school.",
    ],
  },
  {
    id: "schools-rules",
    title: "Schools’ rules are yours to follow",
    summary:
      "We show each school’s AI policy and help you follow it. Submitting within the rules is your responsibility.",
    body: [
      "Where a school limits or forbids AI-written answers, AdmitStories coaches instead of drafting. Where a school asks you to disclose AI help, it drafts an honest disclosure for you to edit.",
      "Schools change their rules. We check each school’s policy every cycle and show the date we checked it, but the school’s own rules are the ones that count.",
    ],
  },
  {
    id: "recommenders",
    title: "Recommenders write their own letters",
    summary: "Briefs help them. The letter is theirs.",
    body: [
      "AdmitStories prepares briefs for your recommenders and a private page for each of them. It never writes a recommendation letter, and you must not write or edit one on a recommender’s behalf.",
      "Invite only people who have agreed to recommend you.",
    ],
  },
  {
    id: "no-promises",
    title: "No promises about outcomes",
    summary:
      "We don’t guarantee admission, interviews or scholarships, and we don’t estimate your odds.",
    body: [
      "Admissions decisions are made by schools. Nothing in AdmitStories is a prediction of, or a promise about, any outcome.",
    ],
  },
  {
    id: "what-you-own",
    title: "What you own",
    summary:
      "Your stories, transcripts and drafts are yours. You give us the licence we need to process them for you, and nothing more.",
    body: [
      "You keep every right in what you tell us and in the drafts we make with you.",
      "You give us a licence to store and process that content only to provide AdmitStories to you. It ends when you delete the content or your account.",
      "The AdmitStories software, design and name are ours.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    summary: `${KIT_PRICE_DISPLAY} per school per cycle, or a pack, through Paddle, our merchant of record. All sales are final.`,
    body: [
      `A school kit costs ${KIT_PRICE_DISPLAY} per school for one application cycle. Paddle sells it to you as merchant of record, adds tax where it applies and issues your receipt. There is no subscription.`,
      `A school pack (${PACKS}) unlocks the school you buy it from at once. Each remaining school is a credit that unlocks one more school, for one application cycle, whenever you choose. Credits don’t expire and can’t be exchanged for money.`,
      SALES_FINAL_RULE,
      "Refinement is unlimited within fair use: rework a draft as often as you need for your own application. Automated or bulk use isn’t fair use.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    summary: "Use AdmitStories for your own application, honestly and gently.",
    body: [
      {
        list: [
          "Don’t upload other people’s essays as your own.",
          "Don’t scrape, copy or resell AdmitStories or its content.",
          "Don’t misuse the voice features, for example by recording someone without their consent.",
          "Don’t try to break, overload or get around the security of the service.",
        ],
      },
      "We may suspend an account that breaks these rules, and we’ll tell you why.",
    ],
  },
  {
    id: "availability",
    title: "Availability, liability, termination, governing law",
    summary: "The legal small print, which counsel is finishing.",
    body: [
      "We work to keep AdmitStories available but can’t promise it will never be interrupted.",
      "You can stop using AdmitStories and delete your account at any time from Settings.",
      `${LIABILITY_TERMS}.`,
      `${GOVERNING_LAW}.`,
      `Questions about these terms: ${HELLO_EMAIL}.`,
    ],
  },
];
