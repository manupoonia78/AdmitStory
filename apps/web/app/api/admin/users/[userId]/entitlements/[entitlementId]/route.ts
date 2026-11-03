import { adjustEntitlement } from "@admitstory/db";
import { EntitlementAdjust } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";

// PATCH /api/admin/users/:userId/entitlements/:entitlementId (spec §5.18): raise a fair-use limit,
// extend or revoke a kit, with a reason. Audited against the user, so they see it in Settings.
export const PATCH = adminRoute<{ userId: string; entitlementId: string }>(
  async (admin, request, { userId, entitlementId }) => {
    const { reason, ...patch } = await readJson(request, EntitlementAdjust);
    const row = await adjustEntitlement(admin, userId, entitlementId, patch, reason);
    if (!row) throw new AdminActionError("That entitlement could not be found.", 404);
    return Response.json({
      id: row.id,
      limits: row.limits,
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
    });
  },
);
