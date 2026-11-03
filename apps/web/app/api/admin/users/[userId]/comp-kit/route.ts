import { CompKit } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { grantCompKit } from "@/lib/admin/comp-kit";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/users/:userId/comp-kit (Phase 9b decision 25): grant one school's kit for free.
export const POST = adminRoute<{ userId: string }>(async (admin, request, { userId }) => {
  const { userSchoolId, reason } = await readJson(request, CompKit);
  const { kitId } = await grantCompKit(admin, userId, userSchoolId, reason);
  return Response.json({ kitId }, { status: 201 });
});
