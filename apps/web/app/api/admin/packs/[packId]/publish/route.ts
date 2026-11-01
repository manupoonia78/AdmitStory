import { emitPackPublished } from "@/lib/admin/dispatch";
import { adminRoute } from "@/lib/admin/guard";
import { publishDraft } from "@/lib/admin/packs";

// POST /api/admin/packs/:packId/publish (spec §11, §9.3 "Publish pack version N+1"): checks the
// gate again, compiles the L1 prompt by code, stores it with its token count, and emits
// kb/pack.published. School Strategy reads the newest published version on its next request.
export const POST = adminRoute<{ packId: string }>(async (admin, _request, { packId }) => {
  const result = await publishDraft(admin, packId);
  await emitPackPublished(result.cycleId, result.version);
  return Response.json({
    packId: result.pack.id,
    version: result.version,
    tokenCount: result.tokenCount,
  });
});
