import { z } from "zod";

// Server environment (spec §17). Parsed on first use, never at import time, so `next build` only
// needs the variables that the code it actually runs reads.

const optional = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const optionalUrl = optional.pipe(z.url().optional());

/** Hosts where sign-in emails go to the local outbox instead of Resend (ADR 0002). */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalAppUrl(appUrl: string): boolean {
  return LOCAL_HOSTS.has(new URL(appUrl).hostname);
}

/**
 * How the Inngest SDK reads INNGEST_DEV (inngest 4.x `Inngest.mode`): "1"/"true" mean dev mode,
 * "0"/"false" mean cloud mode, and any other value is taken as a Dev Server URL, which also means
 * dev mode. Dev mode turns off request signing, so this mirrors the SDK exactly rather than
 * treating any non-empty value as "on".
 */
export function inngestDevMode(value: string | undefined): boolean {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (trimmed === "" || trimmed === "undefined" || trimmed === "0" || trimmed === "false") {
    return false;
  }
  return true;
}

/** INNGEST_DEV: empty, a boolean ("1", "true", "0", "false") or the Dev Server's http(s) URL. */
const inngestDev = optional.refine(
  (value) =>
    value === undefined ||
    /^(0|1|true|false)$/i.test(value) ||
    z.url({ protocol: /^https?$/ }).safeParse(value).success,
  { message: 'INNGEST_DEV must be "1", "0", "true", "false" or the Dev Server URL' },
);

export const ServerEnv = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url({ protocol: /^https?$/, error: "APP_URL must be an http(s) URL" }),
    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
    BETTER_AUTH_SECRET: z
      .string()
      .trim()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    RESEND_API_KEY: optional,
    EMAIL_FROM: optional,
    TURNSTILE_SITE_KEY: optional,
    TURNSTILE_SECRET_KEY: optional,
    POSTHOG_KEY: optional,
    POSTHOG_HOST: optionalUrl,
    SENTRY_DSN: optionalUrl,
    INNGEST_EVENT_KEY: optional,
    INNGEST_SIGNING_KEY: optional,
    INNGEST_DEV: inngestDev,
    LANGFUSE_PUBLIC_KEY: optional,
    LANGFUSE_SECRET_KEY: optional,
    LANGFUSE_HOST: optionalUrl,
    // Voice (Phase 2, §7.5). Each provider is optional: without its key the fake one runs, which
    // only a local APP_URL may use (lib/voice/providers.ts).
    DEEPGRAM_API_KEY: optional,
    TTS_PROVIDER: z.preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
      z.enum(["cartesia", "elevenlabs"]).default("cartesia"),
    ),
    CARTESIA_API_KEY: optional,
    ELEVENLABS_API_KEY: optional,
    FAKE_STT_URL: optional.pipe(z.url({ protocol: /^wss?$/ }).optional()),
    AI_MODE: z.preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
      z.enum(["replay", "live"]).default("replay"),
    ),
  })
  // The widget (site key) and the server check (secret) only make sense together.
  .refine((env) => Boolean(env.TURNSTILE_SITE_KEY) === Boolean(env.TURNSTILE_SECRET_KEY), {
    message: "Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither",
    path: ["TURNSTILE_SITE_KEY"],
  })
  .refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
    message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
    path: ["GOOGLE_CLIENT_ID"],
  })
  // Session cookies are Secure everywhere except localhost, so any other host must be https.
  .refine((env) => isLocalAppUrl(env.APP_URL) || new URL(env.APP_URL).protocol === "https:", {
    message: "APP_URL must use https unless it is localhost",
    path: ["APP_URL"],
  })
  // Inngest dev mode skips request signing, so it is for localhost only, and every other host
  // must verify that /api/inngest requests come from Inngest (fail closed).
  .refine((env) => isLocalAppUrl(env.APP_URL) || !inngestDevMode(env.INNGEST_DEV), {
    message: "INNGEST_DEV turns off request signing and is only allowed when APP_URL is localhost",
    path: ["INNGEST_DEV"],
  })
  .refine((env) => isLocalAppUrl(env.APP_URL) || Boolean(env.INNGEST_SIGNING_KEY), {
    message: "INNGEST_SIGNING_KEY is required unless APP_URL is localhost",
    path: ["INNGEST_SIGNING_KEY"],
  });

export type ServerEnv = z.output<typeof ServerEnv>;

/** Parses an environment object; throws one readable error listing every problem. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = ServerEnv.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      `Invalid server environment. Set these in the repo-root .env.local or the host:\n${lines.join("\n")}`,
    );
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** The validated server environment, parsed once on first call. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export function googleConfigured(
  env: Pick<ServerEnv, "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET">,
) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
