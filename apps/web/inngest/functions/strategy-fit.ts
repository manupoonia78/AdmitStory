import { BudgetExceededError } from "@admitstory/ai";
import { runSchoolFit, userSchoolsForCycle } from "../../lib/strategy/jobs";
import { inngest } from "../client";
import { kbPackPublished, strategyFitRequested } from "../events";

// Spec §5.5: each school's honest flags and looks-for (strategy.school_fit), cached in
// user_schools.fit with the pack version it was computed against. Computed when a school is added,
// and again for every applicant on a cycle when a new pack version is published. Pages read the
// newest pack at request time, so the numbers move at once; the fit follows within the minute.

export const strategyFitFn = inngest.createFunction(
  {
    id: "strategy-fit",
    name: "strategy/fit",
    triggers: [strategyFitRequested],
    // One school's fit at a time per applicant; Haiku is quick, so this stays well inside a minute.
    concurrency: { key: "event.data.userSchoolId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { userId, userSchoolId } = event.data;
    return step.run("compute the fit", async () => {
      try {
        return await runSchoolFit(userId, userSchoolId);
      } catch (error) {
        if (error instanceof BudgetExceededError) return { status: "budget" as const };
        throw error;
      }
    });
  },
);

/** Fans a published pack version out to every applicant who has that school-cycle on their list. */
export const strategyPackPublishedFn = inngest.createFunction(
  {
    id: "strategy-fit-pack-published",
    name: "strategy/fit on kb/pack.published",
    triggers: [kbPackPublished],
    retries: 2,
  },
  async ({ event, step }) => {
    const targets = await step.run("find the applicants", () =>
      userSchoolsForCycle(event.data.cycleId),
    );
    if (targets.length > 0)
      await step.sendEvent(
        "recompute their fit",
        targets.map((target) => strategyFitRequested.create(target)),
      );
    return { cycleId: event.data.cycleId, version: event.data.version, fanout: targets.length };
  },
);
