import { getDb } from "@admitstory/db";
import { ai } from "@/lib/ai";
import { runBriefJob } from "@/lib/recommenders/briefs";
import { inngest } from "../client";
import { lorBriefRequested } from "../events";

// Spec §7.4 `lor/brief` (plan §7): the coverage plan when its inputs changed, then one brief per
// school group for one recommender. One applicant's briefs build one at a time.

export const lorBriefFn = inngest.createFunction(
  {
    id: "lor-brief",
    name: "lor/brief",
    triggers: [lorBriefRequested],
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) =>
    step.run("build the briefs", async () => {
      const result = await runBriefJob({ ai: ai(), db: getDb() }, event.data);
      await ai().flush();
      return result;
    }),
);
