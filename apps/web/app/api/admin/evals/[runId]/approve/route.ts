import { approveEvalRun } from "@admitstory/db";
import { EvalApprove } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/evals/:runId/approve (§8.11): accept a cost rise (or another failure) for this
// run, with a reason. Audited.
export const POST = adminRoute<{ runId: string }>(async (admin, request, { runId }) => {
  const { reason } = await readJson(request, EvalApprove);
  const row = await approveEvalRun(admin, runId, reason);
  if (!row) throw new AdminActionError("That run could not be found.", 404);
  return Response.json({ id: row.id, approvedReason: row.approvedReason });
});
