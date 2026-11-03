import {
  DEFAULT_UTTERANCE_END_MS,
  type SttRefusal,
  type SttTokenResponse,
} from "@admitstory/voice";
import { RATE_LIMITS, checkRateLimit, handle, requireUser } from "@/lib/api";
import {
  fakeProvidersAllowed,
  keytermsFor,
  remainingVoiceSeconds,
  voiceProviders,
  voiceSettingsOf,
} from "@/lib/voice/server";

// POST /api/stt/token (spec §11, §7.5): a short-lived token for one Deepgram streaming connection,
// so the browser streams audio straight to Deepgram and our master key never leaves the server.
//
// A refusal is a 403/503 with a `refusal` code the Studio turns into a state, not an error:
// email not verified (§12.4: verified email before voice), the free voice minutes used up (the
// Studio continues in text), or speech recognition unavailable.

function refuse(status: number, refusal: SttRefusal, error: string): Response {
  return Response.json({ error, refusal }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(): Promise<Response> {
  return handle(async () => {
    const { session, profile } = await requireUser();
    const userId = session.user.id;
    if (session.user.emailVerified !== true)
      return refuse(
        403,
        "email_unverified",
        "Confirm your email address before starting a voice session.",
      );
    checkRateLimit("sttToken", userId, RATE_LIMITS.sttToken);

    const remainingSeconds = await remainingVoiceSeconds(userId);
    if (remainingSeconds <= 0)
      return refuse(
        403,
        "voice_minutes_used",
        "You've used your free voice minutes. Keep going in text; nothing is lost.",
      );

    const { stt } = voiceProviders();
    if (stt.name === "fake" && !fakeProvidersAllowed())
      return refuse(503, "stt_unavailable", "Speaking isn't available right now. Type instead.");

    const settings = voiceSettingsOf(profile);
    try {
      const minted = await stt.mint({
        userId,
        language: settings.speechLanguage,
        keyterms: await keytermsFor(userId),
        utteranceEndMs: DEFAULT_UTTERANCE_END_MS,
      });
      const body: SttTokenResponse = { ...minted, remainingSeconds };
      return Response.json(body, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("[stt] token mint failed", error);
      return refuse(503, "stt_unavailable", "Speaking isn't available right now. Type instead.");
    }
  });
}
