import { compareToBaseline, loadBaseline, runEvalSuite } from "@admitstory/ai";
import { addEvalSamples, createEvalRun, finishEvalRun, getDb, systemContext } from "@admitstory/db";
import { raiseAdminAlert } from "@/lib/alerts";
import { isFeatureOn } from "@/lib/features";
import { inngest } from "../client";
import { evalsRun } from "../events";

// evals/run (spec §8.11, §9.4): canon publish, prompt activation and "Run now" all land here.
//
// In the app this is the replay scan: every recorded reply re-validated against today's schemas,
// the golden invented-fact check, repair rate and cost per call, compared with the committed
// baseline. It is advisory (the gate isn't enforced here, so activation is never blocked); the
// enforcing gate is `eval:gate` in CI and the nightly live run (.github/workflows/evals.yml),
// which also exercise the current prompts end to end. Recorded as a deviation in docs/phase-9.md.

export async function runEvals(data: {
  reason: "canon_published" | "prompt_activated" | "manual";
  canonDocId?: string | undefined;
  promptVersionId?: string | undefined;
  slug?: string | undefined;
  version?: number | undefined;
  runId?: string | undefined;
  triggeredBy?: string | undefined;
}): Promise<{ runId: string; status: string }> {
  const ctx = systemContext(getDb(), "inngest:evals.run");
  const fingerprint = data.slug
    ? `${data.reason === "canon_published" ? "canon" : "prompt"}:${data.slug}${data.version ? `@v${data.version}` : ""}`
    : data.reason;
  const runId =
    data.runId ??
    (
      await createEvalRun(ctx, {
        reason: data.reason,
        mode: "replay",
        fingerprint,
        promptVersionId: data.promptVersionId ?? null,
        canonDocId: data.canonDocId ?? null,
        triggeredBy: data.triggeredBy ?? null,
      })
    ).id;

  if (!(await isFeatureOn("evals"))) {
    await finishEvalRun(ctx, runId, { status: "skipped", error: "Evaluation runs are paused." });
    return { runId, status: "skipped" };
  }
  try {
    const { metrics, samples, notes } = await runEvalSuite({ mode: "replay" });
    const gate = compareToBaseline(metrics, loadBaseline(), {
      enforce: false,
      costApproved: false,
    });
    const withNotes = {
      ...gate,
      note: [
        gate.note,
        ...notes,
        "In-app runs are advisory; CI and the nightly live run enforce the gate.",
      ]
        .filter(Boolean)
        .join(" "),
    };
    await addEvalSamples(ctx, runId, samples);
    const status = gate.passed ? "passed" : "failed";
    await finishEvalRun(ctx, runId, { status, metrics, gate: withNotes, costUsd: 0 });
    if (!gate.passed)
      await raiseAdminAlert({
        kind: "eval_failed",
        key: `eval_failed:${runId}`,
        severity: "warn",
        title: "An evaluation run failed its gate",
        detail: { runId, reason: data.reason, failures: gate.failures.map((f) => f.metric) },
      });
    return { runId, status };
  } catch (error) {
    await finishEvalRun(ctx, runId, {
      status: "error",
      error: error instanceof Error ? error.message : "unknown error",
    });
    throw error;
  }
}

export const evalsRunFn = inngest.createFunction(
  {
    id: "evals-run",
    name: "evals/run",
    triggers: [evalsRun],
    concurrency: { limit: 1 },
    retries: 1,
  },
  async ({ event, step }) => step.run("run the eval suite", () => runEvals(event.data)),
);
