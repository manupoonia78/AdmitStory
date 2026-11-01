import { getDb, setKitStatus } from "@admitstory/db";
import { ai } from "@/lib/ai";
import { finishKit, runStage, STAGE_ORDER } from "@/lib/kit/pipeline";
import { inngest } from "../client";
import { kitGapsAnswered, kitGenerate } from "../events";

// Spec §5.7: the paid kit, one step per stage. Inngest memoises finished steps and each stage also
// persists its output to kit_stages, so a retry or a crash resumes where it stopped. After the gap
// questions the run waits a short while for answers ("Skip, draft with gaps" ends the wait).

/** How long the run waits for blocking gap answers before drafting with NEED chips instead. */
export const GAP_WAIT = process.env.KIT_GAP_WAIT?.trim() || "10m";

export const kitGenerateFn = inngest.createFunction(
  {
    id: "kit-generate",
    name: "kit/generate",
    triggers: [kitGenerate],
    // One kit at a time per applicant, and a global ceiling on concurrent kits (§12.4).
    concurrency: [{ key: "event.data.userId", limit: 1 }, { limit: 20 }],
    retries: 3,
    onFailure: async ({ event }) => {
      const { kitId, userId } = event.data.event.data;
      console.error("[kit] generation failed for good; admin alerted", { kitId });
      await setKitStatus(getDb(), userId, kitId, "failed", {
        error: "Your kit stopped partway. Try again and it picks up where it stopped.",
      });
    },
  },
  async ({ event, step }) => {
    const ref = event.data;
    const deps = () => ({ ai: ai(), db: getDb() });
    await step.run("start", () => setKitStatus(getDb(), ref.userId, ref.kitId, "running"));
    for (const key of STAGE_ORDER) {
      const output = await step.run(key, async () => {
        const result = await runStage(deps(), ref, key);
        await ai().flush();
        return result;
      });
      if (key === "gaps" && !ref.only && ((output as { blocking?: number }).blocking ?? 0) > 0)
        await step.waitForEvent("wait for gap answers", {
          event: kitGapsAnswered,
          timeout: GAP_WAIT,
          if: `async.data.kitId == "${ref.kitId}"`,
        });
    }
    return step.run("finish", () => finishKit(deps(), ref));
  },
);
