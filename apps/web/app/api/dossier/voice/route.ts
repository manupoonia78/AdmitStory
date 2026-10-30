import { getDb, getProfile, getVoiceProfile, updateProfile } from "@admitstory/db";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";

// GET /api/dossier/voice (spec §11, §5.3d): the learned voice profile plus the applicant's own tone
// control. PATCH is not in §11's list; the tone control is part of §5.3d and has to be settable,
// so it lives here rather than in a route the spec does not name either (see docs/phase-1.md).

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const db = getDb();
    const [voice, profile] = await Promise.all([
      getVoiceProfile(db, session.user.id),
      getProfile(db, session.user.id),
    ]);
    return Response.json({
      voice,
      tone: profile?.toneSetting ?? null,
      voiceprint: profile?.voiceprint ?? null,
    });
  });
}

/** Spec §5.3d: three stops, defaulting to how they actually talk. */
const Body = z.object({
  tone: z.enum(["plainspoken", "conversational", "storyteller"]).nullable(),
});

export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const { tone } = await readJson(request, Body);
    await updateProfile(getDb(), session.user.id, { toneSetting: tone });
    return Response.json({ tone });
  });
}
