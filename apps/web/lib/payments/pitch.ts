// The pack story (Manu, 5 Nov 2026), told the same way on the landing page, /pricing and every
// unlock page: other services charge about what our 5-school pack costs and stop at guidelines; we
// give every guideline and draft the essays too. Competitors are never named. Plain data, safe for
// client components and the marketing pages.

import { BUILT_WITH } from "@/lib/model-claims";
import { FEATURED_PLAN, SCHOOL_PLANS, dollars, listCents, savingCents } from "./plans";

const featured = SCHOOL_PLANS[FEATURED_PLAN];
const price = dollars(featured.priceCents);

export const PACK_PITCH = {
  eyebrow: "School packs",
  /** The two-line contrast, in this order. */
  others: `Other services charge about ${price} for guidelines.`,
  ours: `For ${price}, we draft your essays for ${featured.schools} schools.`,
  detail: `Every guideline, plus every essay, short answer and form field drafted from your own stories by a model built with ${BUILT_WITH}.`,
  /** Under the featured price: "$500 one school at a time. You save $151." */
  value: `${dollars(listCents(featured))} one school at a time. You save ${dollars(savingCents(featured))}.`,
  badge: "Most chosen",
  /** The side-by-side: what a guide gives you, and what a pack gives you. */
  compare: {
    othersLabel: "Elsewhere",
    oursLabel: "AdmitStories",
    rows: [
      { others: "Guidelines for each school", ours: "Every guideline, for each school" },
      { others: "A blank page", ours: "Every essay drafted from your stories" },
      { others: "You write the short answers", ours: "Short answers and form fields drafted" },
      { others: "General advice", ours: "A model built with admissions insiders" },
    ],
  },
  credits:
    "A pack unlocks the school you start from straight away. The rest wait as credits; use one on any school, whenever you’re ready.",
} as const;

/** All sales are final (Manu, 5 Nov 2026). Said plainly where people pay. */
export const FINAL_SALE = "All sales are final.";
