// What a production deployment must have (Phase 9b decision 23). Plain module, no "server-only",
// so scripts/launch-check.ts can import it; lib/env.ts refuses to boot when VERCEL_ENV is
// "production" and anything here is missing. Never returns a secret value, only names.

export interface ServiceCheck {
  service: string;
  status: "live" | "fake" | "missing" | "optional";
  detail: string;
  /** True when production refuses to start without it. */
  required: boolean;
}

const has = (env: Record<string, string | undefined>, key: string): boolean =>
  Boolean(env[key]?.trim());

/** One line per service: live, fake (dev only), missing or optional. */
export function serviceChecks(env: Record<string, string | undefined>): ServiceCheck[] {
  const both = (a: string, b: string) => has(env, a) && has(env, b);
  const redis =
    both("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN") ||
    both("KV_REST_API_URL", "KV_REST_API_TOKEN");
  const tts = env.TTS_PROVIDER?.trim() || "deepgram";
  const ttsLive =
    (tts === "deepgram" && has(env, "DEEPGRAM_API_KEY")) ||
    (tts === "openai_compat" && has(env, "OPENAI_TTS_BASE_URL")) ||
    (tts === "cartesia" && has(env, "CARTESIA_API_KEY")) ||
    (tts === "elevenlabs" && has(env, "ELEVENLABS_API_KEY"));
  const aiLive = env.AI_MODE?.trim() === "live" && has(env, "ANTHROPIC_API_KEY");
  return [
    {
      service: "Anthropic (AI_MODE=live)",
      status: aiLive ? "live" : "fake",
      detail: "AI_MODE=live + ANTHROPIC_API_KEY (else replay fixtures)",
      required: true,
    },
    {
      service: "Voyage embeddings",
      status: has(env, "VOYAGE_API_KEY") ? "live" : "fake",
      detail: "VOYAGE_API_KEY",
      required: false,
    },
    {
      service: "Content encryption",
      status: both("CONTENT_ENCRYPTION_KEY_ID", "CONTENT_ENCRYPTION_KEYS") ? "live" : "fake",
      detail: "CONTENT_ENCRYPTION_KEY_ID + CONTENT_ENCRYPTION_KEYS",
      required: true,
    },
    {
      service: "Resend email",
      status: both("RESEND_API_KEY", "EMAIL_FROM") ? "live" : "fake",
      detail: "RESEND_API_KEY + EMAIL_FROM (else the local outbox)",
      required: true,
    },
    {
      service: "Paddle payments",
      status:
        has(env, "PADDLE_API_KEY") &&
        has(env, "PADDLE_WEBHOOK_SECRET") &&
        has(env, "PADDLE_CLIENT_TOKEN")
          ? "live"
          : "fake",
      detail: "PADDLE_API_KEY + PADDLE_WEBHOOK_SECRET + PADDLE_CLIENT_TOKEN",
      required: true,
    },
    {
      service: "Deepgram dictation",
      status: has(env, "DEEPGRAM_API_KEY") ? "live" : "fake",
      detail: "DEEPGRAM_API_KEY",
      required: true,
    },
    {
      service: `Read aloud (${tts})`,
      status: ttsLive ? "live" : "fake",
      detail: "TTS_PROVIDER and its key",
      required: false,
    },
    {
      service: "Upstash Redis (rate limits)",
      status: redis ? "live" : "fake",
      detail: "UPSTASH_REDIS_REST_URL/_TOKEN or KV_REST_API_URL/_TOKEN (else in-process)",
      required: true,
    },
    {
      service: "Inngest",
      status: both("INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY") ? "live" : "fake",
      detail: "INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY (else jobs run inline)",
      required: true,
    },
    {
      service: "Google sign-in",
      status: both("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") ? "live" : "missing",
      detail: "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (else the Google button is hidden)",
      required: true,
    },
    {
      service: "Turnstile",
      status: both("TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY") ? "live" : "optional",
      detail: "TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY",
      required: false,
    },
    {
      service: "Admin alerts",
      status: has(env, "ADMIN_ALERT_EMAIL") ? "live" : "optional",
      detail: "ADMIN_ALERT_EMAIL (else alerts only show in /admin)",
      required: false,
    },
    {
      service: "Sentry",
      status: has(env, "SENTRY_DSN") ? "live" : "optional",
      detail: "SENTRY_DSN",
      required: false,
    },
    {
      service: "PostHog",
      status: has(env, "POSTHOG_KEY") ? "live" : "optional",
      detail: "POSTHOG_KEY + POSTHOG_HOST",
      required: false,
    },
    {
      service: "Langfuse",
      status: has(env, "LANGFUSE_PUBLIC_KEY") ? "live" : "optional",
      detail: "LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY",
      required: false,
    },
  ];
}

/** The services production cannot run without that are not configured, by name. */
export function productionProblems(env: Record<string, string | undefined>): string[] {
  return serviceChecks(env)
    .filter((check) => check.required && check.status !== "live")
    .map((check) => `${check.service}: set ${check.detail}`);
}

export function isProductionDeploy(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV?.trim() === "production";
}
