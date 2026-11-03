import { setUserRole } from "@admitstory/db";
import { RoleChange } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/users/:userId/roles: give or take the admin or expert role, with a reason.
// An admin can't remove their own admin role.
export const POST = adminRoute<{ userId: string }>(async (admin, request, { userId }) => {
  const { role, on, reason } = await readJson(request, RoleChange);
  const roles = await setUserRole(admin, userId, role, on, reason);
  return Response.json({ roles });
});
