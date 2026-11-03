import { updateSchool } from "@admitstory/db";
import { notFound, readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";
import { SchoolDetailsBody } from "@/lib/admin/schemas";

// PATCH /api/admin/schools/:schoolId (spec §11 `/admin/schools*`): the school's identity, which a
// pack needs before it can start (country, city, website). Audited by the repository.
export const PATCH = adminRoute<{ schoolId: string }>(async (admin, request, { schoolId }) => {
  const body = await readJson(request, SchoolDetailsBody);
  const school = await updateSchool(admin, schoolId, body);
  if (!school) notFound("That school");
  return Response.json({ school });
});
