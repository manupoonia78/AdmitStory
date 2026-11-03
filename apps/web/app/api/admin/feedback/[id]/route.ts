import { updateFeedbackStatus } from "@admitstory/db";
import { FeedbackStatusPatch } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";

// PATCH /api/admin/feedback/:id: mark feedback read or done, with an optional note for the team.
export const PATCH = adminRoute<{ id: string }>(async (admin, request, { id }) => {
  const body = await readJson(request, FeedbackStatusPatch);
  const item = await updateFeedbackStatus(admin, id, body);
  if (!item) throw new AdminActionError("That feedback could not be found.", 404);
  return Response.json(item);
});
