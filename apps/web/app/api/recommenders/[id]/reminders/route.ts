import { getDb } from "@admitstory/db";
import { handle, notFound, requireUser } from "@/lib/api";
import { loadReminderViews } from "@/lib/reminders/schedule";
import { idParam } from "@/lib/workspace/route";

// GET /api/recommenders/:id/reminders (spec §5.11, decision 18): the schedule, brought in line
// with the deadlines first, every row with the text that would go out if it went out today.
// Everything starts off: nothing sends until the applicant has read it and switched it on.

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = await idParam(context, "id", "That recommender");
    const views = await loadReminderViews(getDb(), session.user.id, id);
    if (!views) notFound("That recommender");
    return Response.json(views);
  });
}
