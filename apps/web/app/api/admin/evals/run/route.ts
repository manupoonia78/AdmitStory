import { createEvalRun } from "@admitstory/db";
import { EvalRunRequest } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { emitEvalsRun } from "@/lib/admin/dispatch";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/evals/run ("Run now", spec §8.11): records the run, then starts it.
export const POST = adminRoute(async (admin, request) => {
  await readJson(request, EvalRunRequest);
  const run = await createEvalRun(admin, {
    reason: "manual",
    mode: "replay",
    fingerprint: "manual",
    triggeredBy: admin.actorId,
  });
  await emitEvalsRun({
    reason: "manual",
    runId: run.id,
    ...(admin.actorId ? { triggeredBy: admin.actorId } : {}),
  });
  return Response.json({ runId: run.id }, { status: 202 });
});
