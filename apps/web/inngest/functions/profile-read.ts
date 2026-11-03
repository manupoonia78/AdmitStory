import { BudgetExceededError } from "@admitstory/ai";
import { runProfileRead } from "../../lib/profile-read/server";
import { inngest } from "../client";
import { profileReadRequested } from "../events";

// Spec §5.4 AC, §8.5.4: the Profile Read rebuilds on the cheap route after a significant dossier
// change, at most once a day, or whenever the applicant asks. The rule lives in
// lib/profile-read/policy.ts; this only runs it. One build per applicant at a time, so two quick
// requests never produce two versions from the same snapshot.

export const profileReadFn = inngest.createFunction(
  {
    id: "profile-read",
    name: "profile/read",
    triggers: [profileReadRequested],
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { userId, reason } = event.data;
    return step.run("build the read", async () => {
      try {
        return await runProfileRead(userId, reason);
      } catch (error) {
        // The free allowance is spent: the previous read stays on screen. Retrying won't help.
        if (error instanceof BudgetExceededError) return { status: "budget" as const };
        throw error;
      }
    });
  },
);
