import { notFound } from "@/lib/api";
import { ensureDraft, findCycle } from "@/lib/admin/drafts";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/cycles/:cycleId/draft: starts the cycle's working draft from its newest
// published version, or from an empty skeleton when nothing is published. Idempotent.
export const POST = adminRoute<{ cycleId: string }>(async (admin, _request, { cycleId }) => {
  const ref = await findCycle(admin, cycleId);
  if (!ref) notFound("That cycle");
  const draft = await ensureDraft(admin, ref);
  return Response.json({ packId: draft.id, version: draft.version });
});
