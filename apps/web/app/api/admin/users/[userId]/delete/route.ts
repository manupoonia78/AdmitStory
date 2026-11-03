import { adminUserView, recordAudit } from "@admitstory/db";
import { AUDIT_ACTIONS } from "@admitstory/shared";
import { AdminReason } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { requestDeletion } from "@/lib/account/delete";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/users/:userId/delete: the same deletion an applicant can ask for, started by an
// admin (e.g. a request by email), with a reason. 202; the job finishes it.
export const POST = adminRoute<{ userId: string }>(async (admin, request, { userId }) => {
  const { reason } = await readJson(request, AdminReason);
  const user = await adminUserView(admin, userId);
  if (!user) throw new AdminActionError("That account could not be found.", 404);
  if (admin.actorId === userId)
    throw new AdminActionError("Delete your own account from Settings.", 409);
  await recordAudit(admin, {
    action: AUDIT_ACTIONS.accountDelete,
    targetType: "users",
    targetId: userId,
    reason,
  });
  const deletionId = await requestDeletion({
    userId,
    email: user.email,
    reason,
    requestedBy: "admin",
  });
  return Response.json({ deletionId, status: "pending" }, { status: 202 });
});
