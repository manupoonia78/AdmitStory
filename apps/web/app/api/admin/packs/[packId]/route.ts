import { readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";
import { saveDraftJson } from "@/lib/admin/packs";
import { DraftJsonBody } from "@/lib/admin/schemas";

// PUT /api/admin/packs/:packId: the admin's hand edit of the draft (status, _todo, verification,
// official URLs). It must still be a valid pack; published versions are immutable.
export const PUT = adminRoute<{ packId: string }>(async (admin, request, { packId }) => {
  const { data } = await readJson(request, DraftJsonBody);
  const pack = await saveDraftJson(admin, packId, data);
  return Response.json({ packId: pack.id, version: pack.version });
});
