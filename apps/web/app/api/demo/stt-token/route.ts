// public-route: the signed-out landing demo; kill switch, daily cap, Turnstile and a per-visitor rate limit.
// POST /api/demo/stt-token (plan §4, direction §4.2 "Backend"): one scoped speech-to-text token
// for the landing hero's 15-second line. Signed-out, so it is guarded instead: a kill switch, a
// daily cap, Turnstile, and 3 sessions per visitor per hour (Upstash when configured). No model calls; one log line per call
// with the outcome only (never text, IP or token).
//
// A refusal is { error, refusal: "stt_unavailable", reason }, and the hero maps `reason`:
//   paused        switched off, over the daily cap, or no speech provider here (503)
//   turnstile     the browser check failed (403)
//   rate_limited  this visitor's sessions for the hour are used (429)
//   unavailable   the provider wouldn't mint a token (503)

import { DEFAULT_UTTERANCE_END_MS, type SttTokenResponse } from "@admitstory/voice";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { isLocalAppUrl, serverEnv } from "@/lib/env";
import { isFeatureOn } from "@/lib/features";
import { checkIpRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { fakeProvidersAllowed, voiceProviders } from "@/lib/voice/server";

/** How long the client may speak; it stops sending at 15 s (deviation D6). */
const DEMO_SECONDS = 15;
const DEMO_ACTION = "hero_demo";
const MAX_BODY_BYTES = 4096;

type Reason = "paused" | "turnstile" | "rate_limited" | "unavailable";

const Body = z.object({ turnstileToken: z.string().min(1).max(2048).optional() }).strict();

const VISITOR_LIMIT = { limit: 3, windowMs: 60 * 60_000 };

/** "visitor" or "daily" when a limit is reached, else null (shared across instances via Upstash). */
async function overLimit(request: Request, dailyCap: number): Promise<"visitor" | "daily" | null> {
  // Per visitor first, so one visitor over their limit doesn't use up everyone's daily cap.
  try {
    await checkIpRateLimit("demoVisitor", request, VISITOR_LIMIT);
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return "visitor";
    throw error;
  }
  try {
    await checkRateLimit("demoDaily", "all", { limit: dailyCap, windowMs: 24 * 60 * 60_000 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return "daily";
    throw error;
  }
  return null;
}

function refuse(status: number, reason: Reason): Response {
  console.info("[demo-stt]", { outcome: reason });
  return Response.json(
    { error: "Speaking is paused on this page right now.", refusal: "stt_unavailable", reason },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function turnstilePasses(
  token: string | undefined,
  remoteip: string | null,
): Promise<boolean> {
  const env = serverEnv();
  if (!env.TURNSTILE_SECRET_KEY || !token) return false;
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    if (remoteip) form.set("remoteip", remoteip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    if (!result.success) return false;
    if (isLocalAppUrl(env.APP_URL)) return true;
    return result.hostname === new URL(env.APP_URL).hostname && result.action === DEMO_ACTION;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const env = serverEnv();
  const local = isLocalAppUrl(env.APP_URL);

  // 1. The kill switches: DEMO_STT=off is the hard override, landing_demo the admin console's.
  if (env.DEMO_STT === "off" || !(await isFeatureOn("landing_demo"))) return refuse(503, "paused");

  // The body: small, and only an optional Turnstile token.
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) return refuse(403, "turnstile");
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return refuse(403, "turnstile");
  }

  // 2. Turnstile. Without keys, only a local APP_URL may skip it; anywhere else speaking is paused.
  if (env.TURNSTILE_SECRET_KEY) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    if (!(await turnstilePasses(parsed.turnstileToken, ip))) return refuse(403, "turnstile");
  } else if (!local) {
    return refuse(503, "paused");
  }

  // 4 (before 3, so a visitor isn't charged a session when nothing could be minted anyway).
  const { stt } = voiceProviders();
  if (stt.name === "fake" && !fakeProvidersAllowed()) return refuse(503, "paused");

  // 3. Rate limits: per visitor (hashed IP), then the day's cap across all visitors.
  const taken = await overLimit(request, env.DEMO_DAILY_CAP);
  if (taken === "daily") return refuse(503, "paused");
  if (taken === "visitor") return refuse(429, "rate_limited");

  try {
    const minted = await stt.mint({
      userId: "demo",
      language: "en",
      keyterms: [],
      utteranceEndMs: DEFAULT_UTTERANCE_END_MS,
    });
    // Deepgram must not keep the audio for model improvement.
    const url = new URL(minted.url);
    url.searchParams.set("mip_opt_out", "true");
    const body: SttTokenResponse = {
      ...minted,
      url: url.toString(),
      remainingSeconds: DEMO_SECONDS,
    };
    console.info("[demo-stt]", { outcome: "ok" });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return refuse(503, "unavailable");
  }
}
