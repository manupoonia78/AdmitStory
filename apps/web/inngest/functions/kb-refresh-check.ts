import type { BatchSubmission, KbRefreshCheckInput, KbRefreshCheckOutput } from "@admitstory/ai";
import { getDb, systemContext } from "@admitstory/db";
import {
  checkPage,
  isRefreshDay,
  recordRefreshResult,
  refreshTargets,
  type PageChange,
} from "../../lib/admin/refresh";
import { ai } from "../../lib/ai";
import { inngest } from "../client";
import { kbRefreshRequested } from "../events";

// kb/refresh-check (spec §9.3 "Refresh checker", §12.1 "Batch what isn't urgent"). Runs every
// Monday; isRefreshDay() keeps it weekly from August to January and monthly (first Monday)
// otherwise. An admin can run it now from the console (kb/refresh.requested).
//
// Pages are fetched one step each (a failed fetch is logged and skipped, not fatal). Changed pages
// are summarised by kb.refresh_check: through ai.run when there are only a few, and through the
// Batch API (−50%) when there are BATCH_FROM or more. A batch is collected exactly once after it
// ends (packages/ai: collecting twice would write its ledger rows twice); Inngest memoises the
// step that saw it end.

const BATCH_FROM = 4;
const POLL = "10m";
const MAX_POLLS = 150; // 25 hours: the Batch API's own limit is 24.

const JOB = "inngest:kb.refresh-check";

export const kbRefreshCheckFn = inngest.createFunction(
  {
    id: "kb-refresh-check",
    name: "kb/refresh-check",
    triggers: [{ cron: "TZ=UTC 0 6 * * 1" }, kbRefreshRequested],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ event, step, logger }) => {
    const manual = event.name === "kb/refresh.requested";
    if (!manual && !isRefreshDay(new Date())) return { skipped: "not a refresh week" };

    const targets = await step.run("list official URLs", () =>
      refreshTargets(systemContext(getDb(), JOB)),
    );

    const changes: PageChange[] = [];
    for (const [index, target] of targets.entries()) {
      const change = await step.run(`fetch ${index}`, async () => {
        try {
          return await checkPage(systemContext(getDb(), JOB), target, new Date());
        } catch (error) {
          logger.warn(
            `[kb/refresh-check] ${target.url} was not checked: ${error instanceof Error ? error.message : "unknown error"}`,
          );
          return null;
        }
      });
      if (change) changes.push(change);
    }
    if (changes.length === 0) return { checked: targets.length, changed: 0, reviewItems: 0 };

    let outputs: (KbRefreshCheckOutput | null)[];
    if (changes.length < BATCH_FROM) {
      outputs = [];
      for (const [index, change] of changes.entries())
        outputs.push(
          await step.run(`summarise ${index}`, async () => {
            const output = await ai().run("kb.refresh_check", change.input);
            await ai().flush();
            return output;
          }),
        );
    } else {
      const inputs: KbRefreshCheckInput[] = changes.map((change) => change.input);
      const submission = (await step.run("submit batch", () =>
        ai().batch.submit("kb.refresh_check", inputs),
      )) as BatchSubmission<"kb.refresh_check">;
      outputs = changes.map(() => null);
      for (let poll = 0; poll < MAX_POLLS; poll += 1) {
        const result = await step.run(`collect ${poll}`, () =>
          ai().batch.collect(submission, { inputs }),
        );
        if (result.status === "ended") {
          for (const item of result.results)
            if (item.ok) outputs[item.index] = item.output as KbRefreshCheckOutput;
            else logger.warn(`[kb/refresh-check] item ${item.index} failed: ${item.error.message}`);
          break;
        }
        await step.sleep(`wait ${poll}`, POLL);
      }
    }

    const reviewItems = await step.run("create review items", async () => {
      const admin = systemContext(getDb(), JOB);
      let created = 0;
      for (const [index, change] of changes.entries()) {
        const output = outputs[index];
        if (output) created += await recordRefreshResult(admin, change, output);
      }
      return created;
    });
    return { checked: targets.length, changed: changes.length, reviewItems };
  },
);
