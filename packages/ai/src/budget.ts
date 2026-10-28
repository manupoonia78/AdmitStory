import { BudgetExceededError } from "./errors";
import type { LedgerSink } from "./ledger";
import type { Route } from "./routing";

/** Spec §12.4 cost guardrails, in USD. */
export const BUDGET_CAPS = {
  kitSoftUsd: 15,
  kitHardUsd: 25,
  freeUserUsd: 5,
} as const;

export type BudgetCaps = { [K in keyof typeof BUDGET_CAPS]: number };

export type BudgetDecision = "ok" | "downgrade";

/**
 * Decides whether a call may run on its route, must downgrade, or is blocked. Runs before any API
 * call (spec §8.4 step 2).
 *
 * Phase 0 treats every user as a free user: entitlements arrive in Phase 4, which will exempt
 * paying users from the free-user cap and leave them governed by the per-kit caps.
 */
export async function checkBudget(args: {
  ledger: LedgerSink;
  userId?: string | null;
  kitId?: string | null;
  route: Pick<Route, "downgrade">;
  caps?: BudgetCaps;
}): Promise<BudgetDecision> {
  const caps = args.caps ?? BUDGET_CAPS;
  let decision: BudgetDecision = "ok";

  if (args.kitId) {
    const spent = await args.ledger.spentByKit(args.kitId);
    if (spent >= caps.kitHardUsd) throw new BudgetExceededError("kit", caps.kitHardUsd, spent);
    // Past the soft cap only non-critical tasks (those with a downgrade route) change; others run as-is.
    if (spent >= caps.kitSoftUsd && args.route.downgrade) decision = "downgrade";
  }

  if (args.userId) {
    const spent = await args.ledger.spentByUser(args.userId);
    if (spent >= caps.freeUserUsd) {
      // e.g. Studio continues with the Haiku interviewer; everything else is blocked.
      if (!args.route.downgrade) throw new BudgetExceededError("user", caps.freeUserUsd, spent);
      decision = "downgrade";
    }
  }

  return decision;
}
