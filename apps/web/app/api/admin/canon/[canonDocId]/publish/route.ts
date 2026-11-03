import { getCanonVersion, publishCanonVersion } from "@admitstory/db";
import { notFound } from "@/lib/api";
import { emitEvalsRun } from "@/lib/admin/dispatch";
import { adminRoute } from "@/lib/admin/guard";
import { canonRuleIds } from "@/lib/admin/registry";

// POST /api/admin/canon/:canonDocId/publish (spec §9.4): publishing a canon version runs the eval
// suite. The suite arrives in Phase 9; the evals/run event is emitted and logged until then.
export const POST = adminRoute<{ canonDocId: string }>(async (admin, _request, { canonDocId }) => {
  const doc = await getCanonVersion(admin, canonDocId);
  if (!doc) notFound("That canon version");
  canonRuleIds(doc.slug, doc.content);
  const published = await publishCanonVersion(admin, doc.id);
  await emitEvalsRun({
    reason: "canon_published",
    canonDocId: published.id,
    slug: published.slug,
    version: published.version,
  });
  return Response.json({ id: published.id, version: published.version });
});
