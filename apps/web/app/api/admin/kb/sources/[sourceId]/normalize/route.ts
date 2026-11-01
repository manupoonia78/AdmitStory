import { getKbSource, setKbSourceStatus } from "@admitstory/db";
import { notFound } from "@/lib/api";
import { startIngest } from "@/lib/admin/dispatch";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/kb/sources/:sourceId/normalize: "Normalise again" after a failure, or ingest a
// page the refresh checker kept. Chunks are replaced, so running it twice is safe.
export const POST = adminRoute<{ sourceId: string }>(async (admin, _request, { sourceId }) => {
  const source = await getKbSource(admin, sourceId);
  if (!source) notFound("That source");
  await setKbSourceStatus(admin, source.id, "pending");
  const mode = await startIngest(source.id);
  return Response.json({ sourceId: source.id, mode }, { status: 202 });
});
