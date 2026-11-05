// What a school costs (Manu, 5 Nov 2026): $100 for one school, or a pack of 5 for $349 or 10 for
// $699. Plain data, safe for client components and the marketing pages, so the price the app
// charges and the price the landing page shows are the same numbers.

export type PlanId = "school_kit" | "school_pack5" | "school_pack10";

export interface SchoolPlan {
  id: PlanId;
  schools: number;
  priceCents: number;
  /** "1 school", "5 schools". */
  name: string;
}

export const SCHOOL_KIT_PRICE_CENTS = 10_000;
export const SCHOOL_KIT_CURRENCY = "USD";

export const SCHOOL_PLANS: Record<PlanId, SchoolPlan> = {
  school_kit: {
    id: "school_kit",
    schools: 1,
    priceCents: SCHOOL_KIT_PRICE_CENTS,
    name: "1 school",
  },
  school_pack5: { id: "school_pack5", schools: 5, priceCents: 34_900, name: "5 schools" },
  school_pack10: { id: "school_pack10", schools: 10, priceCents: 69_900, name: "10 schools" },
};

/** Single school first, then the packs. */
export const PLAN_ORDER: readonly PlanId[] = ["school_kit", "school_pack5", "school_pack10"];

/** The pack most people buy, and the one every page leads with. */
export const FEATURED_PLAN: PlanId = "school_pack5";

export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** What the plan's schools would cost one at a time ($500 for five). */
export const listCents = (plan: SchoolPlan) => plan.schools * SCHOOL_KIT_PRICE_CENTS;

/** What the pack saves against single kits ($151 for five). */
export const savingCents = (plan: SchoolPlan) => listCents(plan) - plan.priceCents;

/** The price per school, rounded down to the cent ($69.80 for five). */
export const perSchoolCents = (plan: SchoolPlan) => Math.floor(plan.priceCents / plan.schools);
