import { createCanonVersion, listCanonVersions } from "@admitstory/db";
import { readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";
import { canonFiles, canonRuleIds, withFrontMatterVersion } from "@/lib/admin/registry";
import { CanonCreateBody } from "@/lib/admin/schemas";

// POST /api/admin/canon (spec §5.18 "Canon editor", §9.4): saves the next version of a canon file,
// unpublished. Its front matter is stamped with that version and its rule ids are extracted.
export const POST = adminRoute(async (admin, request) => {
  const { slug, content } = await readJson(request, CanonCreateBody);
  const fileVersion = canonFiles().find((file) => file.slug === slug)?.version ?? 0;
  const dbVersion = (await listCanonVersions(admin, slug))[0]?.version ?? 0;
  const stamped = withFrontMatterVersion(content, Math.max(fileVersion, dbVersion) + 1);
  const ruleIds = canonRuleIds(slug, stamped);
  const doc = await createCanonVersion(admin, { slug, content: stamped, ruleIds });
  return Response.json({ id: doc.id, version: doc.version, ruleIds: doc.ruleIds }, { status: 201 });
});
