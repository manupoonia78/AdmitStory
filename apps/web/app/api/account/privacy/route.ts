import { getDb, updateProfile } from "@admitstory/db";
import { PrivacyPrefsPatch } from "@admitstory/shared/schemas";
import { checkRateLimit, handle, readJson, requireUser, RATE_LIMITS } from "@/lib/api";

// PATCH /api/account/privacy (spec §11): "Help improve AdmitStory". Off by default; on, staff may
// read a draft the applicant rated, and include it in the weekly quality review. Never training.

export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("privacyPrefs", userId, RATE_LIMITS.privacyPrefs);
    const { improveOptIn } = await readJson(request, PrivacyPrefsPatch);
    await updateProfile(getDb(), userId, { improveProductOptIn: improveOptIn });
    return Response.json({ improveOptIn }, { headers: { "Cache-Control": "no-store" } });
  });
}
