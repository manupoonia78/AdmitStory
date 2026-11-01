import { deleteKbSource, updateKbSource } from "@admitstory/db";
import { notFound, readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";
import { SourcePatchBody } from "@/lib/admin/schemas";

// PATCH and DELETE /api/admin/kb/sources/:sourceId (spec §5.18 "tag type, trust level, cycle,
// rights note"). Deleting removes the source's chunks and proposals with it.
export const PATCH = adminRoute<{ sourceId: string }>(async (admin, request, { sourceId }) => {
  const body = await readJson(request, SourcePatchBody);
  const source = await updateKbSource(admin, sourceId, body);
  if (!source) notFound("That source");
  return Response.json({ source });
});

export const DELETE = adminRoute<{ sourceId: string }>(async (admin, _request, { sourceId }) => {
  if (!(await deleteKbSource(admin, sourceId))) notFound("That source");
  return new Response(null, { status: 204 });
});
