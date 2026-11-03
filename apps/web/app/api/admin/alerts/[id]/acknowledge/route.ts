import { acknowledgeAdminAlert } from "@admitstory/db";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/alerts/:id/acknowledge: mark an alert seen. A repeat of the same key reopens it.
export const POST = adminRoute<{ id: string }>(async (admin, _request, { id }) => {
  const row = await acknowledgeAdminAlert(admin, id);
  if (!row) throw new AdminActionError("That alert is already acknowledged or gone.", 404);
  return Response.json({ id: row.id, acknowledgedAt: row.acknowledgedAt });
});
