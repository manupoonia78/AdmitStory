import { isFeatureOn } from "@/lib/features";
import { runDueReminders } from "@/lib/reminders/send";
import { inngest } from "../client";
import { recommenderRemindersRun } from "../events";

// Spec §7.4 `notify/*` (plan §7): every hour, send the recommender reminders that are due and that
// the applicant previewed and switched on; re-check each one's preview hash before it goes. While
// the `recommender_emails` switch is off the run sends nothing; due reminders wait for the next.

export const recommenderRemindersFn = inngest.createFunction(
  {
    id: "recommender-reminders",
    name: "notify/recommender-reminders",
    triggers: [{ cron: "TZ=UTC 5 * * * *" }, recommenderRemindersRun],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ step }) =>
    step.run("send due reminders", async () =>
      (await isFeatureOn("recommender_emails"))
        ? runDueReminders()
        : { sent: 0, skipped: 0, changed: 0, paused: true },
    ),
);
