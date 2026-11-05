// The prices and what they include (direction §4.8, §5), in one place, so the landing pricing
// section (package C), /pricing (D) and /terms (E) can't drift apart. The numbers come from
// lib/payments/plans.ts, the same list the app charges from: $100 a school, or a pack of 5 for $349
// or 10 for $699 (Manu, 5 Nov 2026).
//
// KIT_PRICE_DISPLAY must equal KIT_PRICE in packages/ui/src/strategy/kit-preview.tsx. It isn't
// imported from there on purpose: that module carries the kit preview's client Button, and this
// file is safe for client islands to import.
//
// Interview practice is "Coming soon" (plan OVERRIDE): it is never listed as included. The kit list
// says so in words, with the coming-soon line.
//
// Phase 8 is deferred too (Manu, 2 Nov 2026; docs/phase-8-experts-connect-tracker.md), so unlike
// interview practice it is not sold at all: no application tracker in the free list, and no expert
// mock interview add-on. Put them back here when that phase ships.

import {
  FEATURED_PLAN,
  PLAN_ORDER,
  SCHOOL_KIT_PRICE_CENTS,
  SCHOOL_PLANS,
  dollars,
  listCents,
  perSchoolCents,
  savingCents,
  type PlanId,
} from "@/lib/payments/plans";
import {
  COMING_SOON,
  INTERVIEW_COMING_SOON_LINE,
  SALES_FINAL_RULE,
  TAX_LINE,
} from "../_copy/shared";

export const CURRENCY = "USD";
export const FREE_PRICE_USD = 0;
export const KIT_PRICE_USD = SCHOOL_KIT_PRICE_CENTS / 100;
export const FREE_PRICE_DISPLAY = "$0";
export const KIT_PRICE_DISPLAY = dollars(SCHOOL_KIT_PRICE_CENTS);
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
  "Story Studio, by voice or typing: the first half free",
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
  "The rest of Story Studio",
  "Connect: message alumni, students and admissions readers from that school",
] as const;

export interface PlanCard {
  id: PlanId;
  name: string;
  price: string;
  priceUsd: number;
  /** The one-at-a-time price, struck through on packs; null for a single school. */
  was: string | null;
  /** "$69.80 a school · save $151", or what one school gets. */
  line: string;
  featured: boolean;
}

/** The three ways to buy, single school first; the 5-school pack is featured. */
export const PLAN_CARDS: readonly PlanCard[] = PLAN_ORDER.map((id) => {
  const plan = SCHOOL_PLANS[id];
  const pack = plan.schools > 1;
  return {
    id,
    name: plan.name,
    price: dollars(plan.priceCents),
    priceUsd: plan.priceCents / 100,
    was: pack ? dollars(listCents(plan)) : null,
    line: pack
      ? `${dollars(perSchoolCents(plan))} a school · save ${dollars(savingCents(plan))}`
      : "Everything one school asks for",
    featured: id === FEATURED_PLAN,
  };
});

/** The lowest price per school, in the biggest pack ($69.90). */
export const PACK_FROM_DISPLAY = dollars(perSchoolCents(SCHOOL_PLANS.school_pack10));

/** Shown under the kit list, labelled, never as an included feature. */
export const KIT_COMING_SOON = {
  label: COMING_SOON,
  feature: "Interview plan, practice drills and voice mock interviews",
  line: INTERVIEW_COMING_SOON_LINE,
} as const;

export { SALES_FINAL_RULE, TAX_LINE };

/** The tax and final-sale line under the landing pricing. */
export const TAX_AND_FINAL_LINE = `${TAX_LINE} ${SALES_FINAL_RULE}`;
