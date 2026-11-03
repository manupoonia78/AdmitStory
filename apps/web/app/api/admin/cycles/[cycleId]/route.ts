import { updateCycle } from "@admitstory/db";
import { notFound, readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";
import { CyclePatchBody } from "@/lib/admin/schemas";

// PATCH /api/admin/cycles/:cycleId (spec §5.18 "rounds, deadlines"): status and the rounds table.
export const PATCH = adminRoute<{ cycleId: string }>(async (admin, request, { cycleId }) => {
  const body = await readJson(request, CyclePatchBody);
  const cycle = await updateCycle(admin, cycleId, body);
  if (!cycle) notFound("That cycle");
  return Response.json({ cycle });
});
