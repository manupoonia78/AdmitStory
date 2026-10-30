import { createStudioSession, getDb, getResumableSession, updateProfile } from "@admitstory/db";
import { z } from "zod";
import { handle, readJson, requireUser } from "@/lib/api";
import { askNextQuestion } from "@/lib/studio/turn";
import { captureServerEvent } from "@/lib/analytics/server";

// POST /api/studio/sessions (spec §11). Starts a session, or resumes the one still open: progress
// is saved after every answer, so coming back always continues rather than starting again (§5.2).

const Body = z.object({
  /** Omitted means "use the mode first run chose"; sending one changes it (e.g. "I'm short on time"). */
  mode: z.enum(["express", "standard", "deep"]).optional(),
  /** Force a new session even if one is open. */
  fresh: z.boolean().default(false),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session: auth, profile } = await requireUser();
    const body = await readJson(request, Body);
    const db = getDb();
    const userId = auth.user.id;

    const mode = body.mode ?? profile.studioMode ?? "standard";
    if (body.mode && body.mode !== profile.studioMode)
      await updateProfile(db, userId, { studioMode: body.mode });

    const existing = body.fresh ? null : await getResumableSession(db, userId);
    const session = existing ?? (await createStudioSession(db, userId, { mode }));
    const resumed = existing !== null;

    if (!resumed)
      await captureServerEvent({
        distinctId: userId,
        event: "studio_started",
        properties: { mode },
      });

    const next = await askNextQuestion(userId, { session });

    return Response.json({
      session: {
        id: session.id,
        mode: session.mode,
        chapter: next?.chapter ?? session.currentChapter,
        status: session.status,
        resumed,
      },
      question: next,
    });
  });
}
