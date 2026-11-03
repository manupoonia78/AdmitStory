import { ttsLines, type TtsStreamLine } from "@admitstory/voice";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { MAX_TTS_CHARS, TtsSpeedSchema, TtsVoiceSchema } from "@/lib/voice/schemas";
import {
  fakeProvidersAllowed,
  meterSpeech,
  voiceProviders,
  voiceSettingsOf,
} from "@/lib/voice/server";

// POST /api/tts (spec §11, §7.5): a question read aloud, streamed as NDJSON lines in the order
// TtsStreamLine describes, so audio starts playing while the rest is still being synthesised.
// Cached by text + voice + speed for 24 h; only a fresh synthesis is metered. When the applicant
// leaves mid-stream the provider request is aborted, so nobody pays for audio no one hears.

const Body = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
  voice: TtsVoiceSchema.optional(),
  speed: TtsSpeedSchema.optional(),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session, profile } = await requireUser();
    const userId = session.user.id;
    if (session.user.emailVerified !== true)
      return Response.json(
        {
          error: "Confirm your email address to hear questions read aloud.",
          refusal: "email_unverified",
        },
        { status: 403 },
      );
    const body = await readJson(request, Body);
    checkRateLimit("tts", userId, RATE_LIMITS.tts);

    const { tts, ttsCache } = voiceProviders();
    if (tts.name === "fake" && !fakeProvidersAllowed())
      return Response.json({ error: "Read-aloud isn't available right now." }, { status: 503 });

    const settings = voiceSettingsOf(profile);
    const input = {
      text: body.text,
      voice: body.voice ?? settings.ttsVoice,
      speed: body.speed ?? settings.ttsSpeed,
    };

    const abort = new AbortController();
    const onClientGone = () => abort.abort();
    request.signal.addEventListener("abort", onClientGone, { once: true });

    const lines = ttsLines(input, {
      provider: tts,
      cache: ttsCache,
      signal: abort.signal,
      onSynthesized: async ({ chars, latencyMs }) => {
        try {
          await meterSpeech(userId, tts.name, chars, latencyMs);
        } catch (error) {
          // The applicant has the audio; a failed ledger write is ours to notice, not theirs.
          console.error("[tts] ledger write failed", error);
        }
      },
    });

    const encoder = new TextEncoder();
    const encode = (line: TtsStreamLine) => encoder.encode(`${JSON.stringify(line)}\n`);
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await lines.next();
        if (done) {
          request.signal.removeEventListener("abort", onClientGone);
          controller.close();
        } else controller.enqueue(encode(value));
      },
      async cancel() {
        abort.abort();
        request.signal.removeEventListener("abort", onClientGone);
        await lines.return(undefined);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
