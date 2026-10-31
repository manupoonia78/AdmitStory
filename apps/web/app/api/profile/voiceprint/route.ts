import { getDb, getProfile, saveVoiceprint } from "@admitstory/db";
import { RATE_LIMITS, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { SpokenVoiceprintBody } from "@/lib/voice/schemas";

// PUT /api/profile/voiceprint (spec §6.2): the Voiceprint identity the browser computed from the
// applicant's first minutes of speech. Only these derived numbers arrive; no audio is sent or kept.
// It replaces an identity seeded from writing, and is computed once: a second one is ignored.

export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const identity = await readJson(request, SpokenVoiceprintBody);
    const db = getDb();
    const saved = await saveVoiceprint(db, session.user.id, identity);
    const profile = await getProfile(db, session.user.id);
    return Response.json({ saved, voiceprint: profile?.voiceprint ?? null });
  });
}
