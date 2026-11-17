// The headline each page's Open Graph image carries (SPEC §4.2). Prices come from plans.ts.

import { FEATURED_PLAN, SCHOOL_PLANS, dollars } from "@/lib/payments/plans";
import type { OgInput } from "./og-image";

const PACK = SCHOOL_PLANS[FEATURED_PLAN];

export const OG_HEADLINES = {
  home: { lead: "Tell it once.", accent: "Tell it well.", path: "/" },
  how: { lead: "From one conversation", accent: "to every school.", path: "/how-it-works" },
  pricing: {
    lead: `${PACK.schools} schools.`,
    accent: `${dollars(PACK.priceCents)}.`,
    path: "/pricing",
  },
  privacy: { lead: "Privacy,", accent: "in plain words.", path: "/privacy" },
  terms: { lead: "Terms,", accent: "in plain words.", path: "/terms" },
} as const satisfies Record<string, OgInput>;
