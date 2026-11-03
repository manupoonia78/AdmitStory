// The prices and what they include (direction §4.8, §5), in one place, so the landing pricing
// section (package C), /pricing (D) and /terms (E) can't drift apart.
//
// KIT_PRICE_DISPLAY must equal KIT_PRICE in packages/ui/src/strategy/kit-preview.tsx (the price the
// app charges). It isn't imported from there on purpose: that module carries the kit preview's
// client Button, and this file is safe for client islands to import.
//
// Interview practice is "Coming soon" (plan OVERRIDE): it is never listed as included. The kit list
// says so in words, with the coming-soon line.
//
// Phase 8 is deferred too (Manu, 2 Nov 2026; docs/phase-8-experts-connect-tracker.md), so unlike
// interview practice it is not sold at all: no application tracker in the free list, and no expert
// mock interview add-on. Put them back here when that phase ships.

import { COMING_SOON, INTERVIEW_COMING_SOON_LINE, REFUND_RULE, TAX_LINE } from "../_copy/shared";

export const CURRENCY = "USD";
export const FREE_PRICE_USD = 0;
export const KIT_PRICE_USD = 100;
export const FREE_PRICE_DISPLAY = "$0";
export const KIT_PRICE_DISPLAY = "$100";
export const PER_SCHOOL = "per school";

export const FREE_PLAN = {
  name: "Free",
  price: FREE_PRICE_DISPLAY,
  line: "Talk, and see how you'll be read.",
} as const;

export const KIT_PLAN = {
  name: "School kit",
  price: KIT_PRICE_DISPLAY,
  unit: PER_SCHOOL,
  line: "Everything one school asks for.",
} as const;

export const FREE_FEATURES = [
  "Story Studio, by voice or typing",
  "Your Story Bank and Fact Sheet",
  "Profile Read: how admissions will likely see you",
  "School Strategy and the round planner",
  "A preview of each school's kit: the positioning, which story goes where, and every deliverable, locked",
] as const;

export const KIT_FEATURES = [
  "Positioning and a file map for that school",
  "Every essay and short answer, with options and the reasons for each",
  "Refinement until you're happy (fair use)",
  "Form entries and a résumé pass",
  "Briefs for your recommenders",
] as const;

/** Shown under the kit list, labelled, never as an included feature. */
export const KIT_COMING_SOON = {
  label: COMING_SOON,
  feature: "Interview plan, practice drills and voice mock interviews",
  line: INTERVIEW_COMING_SOON_LINE,
} as const;

export { REFUND_RULE, TAX_LINE };

/** The tax and refund line under the landing pricing plane. */
export const TAX_AND_REFUND_LINE = `${TAX_LINE} ${REFUND_RULE}`;
