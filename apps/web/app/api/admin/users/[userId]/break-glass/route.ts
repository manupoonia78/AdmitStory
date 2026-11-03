import { openBreakGlass } from "@admitstory/db";
import { BreakGlassOpen } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/users/:userId/break-glass (spec §14.4): open 30 minutes of read-only access to
// this account's content, with a reason of at least 20 characters. Audited on open and on every
// view, and listed to the applicant in Settings › Privacy.
export const POST = adminRoute<{ userId: string }>(async (admin, request, { userId }) => {
  const { reason } = await readJson(request, BreakGlassOpen);
  const grant = await openBreakGlass(admin, userId, reason, new Date());
  return Response.json({ expiresAt: grant.expiresAt.toISOString() }, { status: 201 });
});
