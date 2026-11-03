import {
  DEFAULT_UTTERANCE_END_MS,
  type SttRefusal,
  type SttTokenResponse,
} from "@admitstory/voice";
import { PORTAL_LIMITS } from "@admitstory/shared/kit";
import { readPortalWorkspace, getDb } from "@admitstory/db";
import {
  PORTAL_HEADERS,
  handlePortal,
  portalAccess,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";
import { fakeProvidersAllowed, voiceProviders } from "@/lib/voice/server";
import { isFeatureOn, pausedMessage } from "@/lib/features";

// POST /api/r/:token/stt (spec §7.5): a short-lived token for one streaming connection, so the
// recommender's speech goes straight to the transcriber and our key never leaves the server.
//
// The dictation allowance is the invite's hour (decision 21), not the applicant's minutes: a
// recommender's page must not be able to spend what the applicant bought for the Studio.

function refuse(status: number, refusal: SttRefusal, error: string): Response {
  return Response.json({ error, refusal }, { status, headers: PORTAL_HEADERS });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("stt", access.inviteId);
    const workspace = await readPortalWorkspace(getDb(), access);
    const remainingSeconds = Math.max(0, PORTAL_LIMITS.voiceSeconds - workspace.voiceSeconds);
    if (remainingSeconds <= 0)
      return refuse(
        403,
        "voice_minutes_used",
        "You've used the dictation this page allows. Keep going in text; nothing is lost.",
      );

    if (!(await isFeatureOn("studio_voice")))
      return refuse(503, "stt_unavailable", await pausedMessage("studio_voice"));
    const { stt } = voiceProviders();
    if (stt.name === "fake" && !fakeProvidersAllowed())
      return refuse(503, "stt_unavailable", "Speaking isn't available right now. Type instead.");
    try {
      const minted = await stt.mint({
        userId: access.userId,
        language: "en",
        keyterms: [],
        utteranceEndMs: DEFAULT_UTTERANCE_END_MS,
      });
      const body: SttTokenResponse = { ...minted, remainingSeconds };
      return Response.json(body, { headers: PORTAL_HEADERS });
    } catch (error) {
      console.error("[portal] stt token mint failed", error);
      return refuse(503, "stt_unavailable", "Speaking isn't available right now. Type instead.");
    }
  });
}
