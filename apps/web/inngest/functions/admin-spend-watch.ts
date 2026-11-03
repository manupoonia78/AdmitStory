import { getDb, spendSnapshot, systemContext } from "@admitstory/db";
import { raiseAdminAlert } from "@/lib/alerts";
import { inngest } from "../client";
import { adminSpendWatch } from "../events";

// The hourly spend watch (spec §12.4, Phase 9b decision 12): live spend only.
//  - spend_spike  today's spend so far is above 1.5× the trailing 7-day daily mean (and over $5)
//  - kit_hard_cap a kit's lifetime spend reached $25 (critical: the budget step refuses it now)
//  - kit_soft_cap a kit passed $15 (info)
//  - repair_rate  a task's repair attempts exceed 20% of its first attempts over 24 h (≥ 20 calls)
// Each alert has a dedupe key, so a condition that holds all day is one row with a count.

const SPIKE_FACTOR = 1.5;
const SPIKE_FLOOR_USD = 5;
const REPAIR_RATE = 0.2;
const REPAIR_MIN_CALLS = 20;

export async function runSpendWatch(now: Date = new Date()): Promise<{ raised: number }> {
  const snapshot = await spendSnapshot(systemContext(getDb(), "inngest:admin.spend-watch"), now);
  const day = now.toISOString().slice(0, 10);
  let raised = 0;
  const raise = async (input: Parameters<typeof raiseAdminAlert>[0]) => {
    raised += 1;
    await raiseAdminAlert(input);
  };

  if (
    snapshot.todayUsd > SPIKE_FLOOR_USD &&
    snapshot.trailingDailyMeanUsd > 0 &&
    snapshot.todayUsd > snapshot.trailingDailyMeanUsd * SPIKE_FACTOR
  )
    await raise({
      kind: "spend_spike",
      key: `spend_spike:${day}`,
      severity: "warn",
      title: "Spend is running high today",
      detail: {
        todayUsd: Number(snapshot.todayUsd.toFixed(2)),
        trailingDailyMeanUsd: Number(snapshot.trailingDailyMeanUsd.toFixed(2)),
      },
    });
  for (const kit of snapshot.kitsOverHard)
    await raise({
      kind: "kit_hard_cap",
      key: `kit_hard_cap:${kit.kitId}`,
      severity: "critical",
      title: "A kit reached its hard cost cap",
      detail: { kitId: kit.kitId, userId: kit.userId, usd: Number(kit.usd.toFixed(2)) },
    });
  for (const kit of snapshot.kitsOverSoft)
    await raise({
      kind: "kit_soft_cap",
      key: `kit_soft_cap:${kit.kitId}`,
      severity: "info",
      title: "A kit passed its soft cost cap",
      detail: { kitId: kit.kitId, usd: Number(kit.usd.toFixed(2)) },
    });
  for (const task of snapshot.repairRates)
    if (task.primaries >= REPAIR_MIN_CALLS && task.repairs / task.primaries > REPAIR_RATE)
      await raise({
        kind: "repair_rate",
        key: `repair_rate:${task.task}:${day}`,
        severity: "warn",
        title: "A task needs repairs too often",
        detail: { task: task.task, primaries: task.primaries, repairs: task.repairs },
      });
  return { raised };
}

export const spendWatchFn = inngest.createFunction(
  {
    id: "admin-spend-watch",
    name: "admin/spend-watch",
    triggers: [{ cron: "TZ=UTC 7 * * * *" }, adminSpendWatch],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ step }) => step.run("check spend", () => runSpendWatch()),
);
