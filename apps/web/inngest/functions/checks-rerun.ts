import { getDb } from "@admitstory/db";
import { rerunChecksAfterEdit } from "@/lib/kit/stale";
import { inngest } from "../client";
import { checksRerun } from "../events";

// Spec §5.3 AC: editing a fact or story marks every draft that used it stale, and their checks are
// run again against the changed dossier.

export const checksRerunFn = inngest.createFunction(
  {
    id: "checks-rerun",
    name: "checks/rerun",
    triggers: [checksRerun],
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 2,
  },
  async ({ event, step }) =>
    step.run("mark stale and re-check", () => rerunChecksAfterEdit(getDb(), event.data)),
);
