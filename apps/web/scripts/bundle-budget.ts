// First-load JS budgets per route, in KB gzipped (spec §6.11; plan §3.9, deviation D1).
// App routes: 160. The five marketing routes: 155 (the framework floor is about 133 KB and the
// root layout adds about 8, so the direction's 120 can't be met; the target on "/" is ≤ 152).

import { isMarketingRoute } from "../lib/marketing/routes";

export const APP_BUDGET_KB = 160;
export const MARKETING_BUDGET_KB = 155;

export function budgetFor(route: string): number {
  return isMarketingRoute(route) ? MARKETING_BUDGET_KB : APP_BUDGET_KB;
}
