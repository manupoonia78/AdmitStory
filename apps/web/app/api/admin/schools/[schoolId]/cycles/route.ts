import { createCycle } from "@admitstory/db";
import { readJson } from "@/lib/api";
import { findCycleByName, schoolOrThrow } from "@/lib/admin/drafts";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";
import { CycleCreateBody } from "@/lib/admin/schemas";

// POST /api/admin/schools/:schoolId/cycles (spec §5.18 "create cycles"). A new cycle is a draft:
// applicants see it only once a pack version is published.
export const POST = adminRoute<{ schoolId: string }>(async (admin, request, { schoolId }) => {
  const { cycle } = await readJson(request, CycleCreateBody);
  const school = await schoolOrThrow(admin, schoolId);
  if (await findCycleByName(admin, school.id, cycle))
    throw new AdminActionError(`${school.shortName} already has a ${cycle} cycle.`);
  const row = await createCycle(admin, { schoolId: school.id, cycle, status: "draft" });
  return Response.json({ cycle: row }, { status: 201 });
});
