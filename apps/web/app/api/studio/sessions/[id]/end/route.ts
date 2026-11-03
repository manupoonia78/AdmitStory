import { countUserTurns, endStudioSession, getDb, getStudioSession } from "@admitstory/db";
import { dossierConsolidate, inngest } from "@/inngest";
import { captureServerEvent } from "@/lib/analytics/server";
import { handle, notFound, requireUser } from "@/lib/api";
import { sessionSummary } from "@/lib/studio/summary";

// POST /api/studio/sessions/:id/end (spec §11). Ends the session and returns the summary card
// §5.2 describes: stories found, facts confirmed, what is still thin, and the next step.

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session: auth } = await requireUser();
    const userId = auth.user.id;
    const { id } = await context.params;

    const db = getDb();
    const session = await getStudioSession(db, userId, id);
    if (!session) notFound("That session");

    if (session.status !== "ended") await endStudioSession(db, userId, id);
    const turns = await countUserTurns(db, userId, id);
    const summary = await sessionSummary(userId);

    // A last consolidation so the Dossier is settled before they look at it.
    await inngest.send(dossierConsolidate.create({ userId, reason: "session_end" }));

    await captureServerEvent({
      distinctId: userId,
      event: "studio_session_ended",
      properties: { mode: session.mode, turns, stories: summary.storyCount },
    });

    return Response.json({ ended: true, turns, summary });
  });
}
