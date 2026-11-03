import { getDb, getDeliverable } from "@admitstory/db";
import { ai } from "@/lib/ai";
import { draftOption } from "@/lib/kit/options";
import { inngest } from "../client";
import { kitDraftOption } from "../events";

// Spec §5.7 stage 6: Options B and C are drafted on demand, when the applicant asks.

export const kitDraftOptionFn = inngest.createFunction(
  {
    id: "kit-draft-option",
    name: "kit/draft-option",
    triggers: [kitDraftOption],
    concurrency: { key: "event.data.deliverableId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { userId, deliverableId, angleId } = event.data;
    return step.run("draft the option", async () => {
      const deliverable = await getDeliverable(getDb(), userId, deliverableId);
      if (!deliverable) return { status: "not_found" as const };
      const draft = await draftOption({ ai: ai(), db: getDb() }, userId, deliverable, angleId);
      await ai().flush();
      return { status: "drafted" as const, draftId: draft.id };
    });
  },
);
