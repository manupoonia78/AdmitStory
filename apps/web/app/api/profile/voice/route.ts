import { getDb, updateVoiceSettings } from "@admitstory/db";
import type { VoiceSettings } from "@admitstory/voice";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { VoiceSettingsPatchBody } from "@/lib/voice/schemas";
import { voiceSettingsOf } from "@/lib/voice/server";

// GET/PATCH /api/profile/voice (spec §5.1 Settings): read questions aloud, the interviewer's voice
// and speed, and the language the applicant speaks in. Not in §11's list, which names no settings
// routes at all; it follows the /api/dossier/voice pattern.

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { profile } = await requireUser();
    return Response.json(voiceSettingsOf(profile) satisfies VoiceSettings);
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const patch = await readJson(request, VoiceSettingsPatchBody);
    const row = await updateVoiceSettings(getDb(), session.user.id, patch);
    if (!row) notFound("Your profile");
    return Response.json(voiceSettingsOf(row) satisfies VoiceSettings);
  });
}
