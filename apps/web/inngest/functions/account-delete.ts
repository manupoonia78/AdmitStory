import { runAccountDeletion } from "@/lib/account/delete";
import { inngest } from "../client";
import { accountDeleteRequested } from "../events";

// account/delete (spec §14.4, Phase 9b decision 13): email the confirmation, then delete the users
// row. Retried three times; the last failure marks the request failed and alerts an admin.

export const accountDeleteFn = inngest.createFunction(
  {
    id: "account-delete",
    name: "account/delete",
    triggers: [accountDeleteRequested],
    retries: 3,
  },
  async ({ event, step }) =>
    step.run("delete the account", () => runAccountDeletion(event.data.deletionId)),
);
