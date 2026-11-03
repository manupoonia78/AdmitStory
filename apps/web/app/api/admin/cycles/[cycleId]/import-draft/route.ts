import { notFound } from "@/lib/api";
import { findCycle, importDraftFile } from "@/lib/admin/drafts";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/cycles/:cycleId/import-draft: loads knowledge/schools/<slug>/<cycle>/
// pack.draft.json (Appendix G for Darden) as the cycle's working draft. Its items stay unverified.
export const POST = adminRoute<{ cycleId: string }>(async (admin, _request, { cycleId }) => {
  const ref = await findCycle(admin, cycleId);
  if (!ref) notFound("That cycle");
  const pack = await importDraftFile(admin, ref);
  return Response.json({ packId: pack.id, version: pack.version });
});
