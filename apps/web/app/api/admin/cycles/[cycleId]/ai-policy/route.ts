import { AiPolicyInput, upsertAiPolicy } from "@admitstory/db";
import { notFound, readJson } from "@/lib/api";
import { findCycle } from "@/lib/admin/drafts";
import { adminRoute } from "@/lib/admin/guard";

// PUT /api/admin/cycles/:cycleId/ai-policy (spec §5.18 "AI policy registry", §14.2). Every save
// sets or clears the verified date: an edited stance never inherits an older verification.
export const PUT = adminRoute<{ cycleId: string }>(async (admin, request, { cycleId }) => {
  const body = await readJson(request, AiPolicyInput);
  if (!(await findCycle(admin, cycleId))) notFound("That cycle");
  const policy = await upsertAiPolicy(admin, cycleId, body);
  return Response.json({ policy });
});
