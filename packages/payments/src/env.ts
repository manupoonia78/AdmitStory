import { PaymentsConfigError, type PaddleEnvironment } from "./provider";

// The payments environment (spec §17). Read on first use, never at import time. Parsed by hand, as
// packages/voice does: these are a handful of optional strings.
//
// Missing Paddle keys are not an error: local development runs on the fake provider, which
// select.ts picks when APP_URL is localhost. A half-configured Paddle is an error, because it
// would otherwise fall back to the fake without anyone noticing.

export interface PaymentsEnv {
  appUrl: string | undefined;
  paddleEnv: PaddleEnvironment;
  paddleApiKey: string | undefined;
  paddleWebhookSecret: string | undefined;
  paddleClientToken: string | undefined;
  /** A catalog price (`pri_…`) for the school kit. Without it, checkout sends a non-catalog price. */
  paddlePriceSchoolKit: string | undefined;
}

const value = (raw: string | undefined): string | undefined => {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
};

export function parsePaymentsEnv(source: Record<string, string | undefined>): PaymentsEnv {
  const rawEnv = value(source.PADDLE_ENV)?.toLowerCase() ?? "sandbox";
  // Paddle.js calls live "production"; accept both spellings.
  const paddleEnv = rawEnv === "production" ? "live" : rawEnv;
  if (paddleEnv !== "sandbox" && paddleEnv !== "live")
    throw new PaymentsConfigError(`PADDLE_ENV must be "sandbox" or "live", not "${rawEnv}".`);

  const env: PaymentsEnv = {
    appUrl: value(source.APP_URL),
    paddleEnv,
    paddleApiKey: value(source.PADDLE_API_KEY),
    paddleWebhookSecret: value(source.PADDLE_WEBHOOK_SECRET),
    paddleClientToken: value(source.PADDLE_CLIENT_TOKEN),
    paddlePriceSchoolKit: value(source.PADDLE_PRICE_SCHOOL_KIT),
  };

  const set = [env.paddleApiKey, env.paddleWebhookSecret, env.paddleClientToken].filter(Boolean);
  if (set.length > 0 && set.length < 3)
    throw new PaymentsConfigError(
      "Set PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET and PADDLE_CLIENT_TOKEN together, or none of them.",
    );
  if (env.paddlePriceSchoolKit && !env.paddlePriceSchoolKit.startsWith("pri_"))
    throw new PaymentsConfigError("PADDLE_PRICE_SCHOOL_KIT must be a Paddle price id (pri_…).");

  // Paddle prefixes keys by environment. A sandbox key against the live API (or the reverse) fails
  // with an opaque 403, so catch the mix-up here. Keys without the prefix (older format) pass.
  const apiKeyEnv = /^pdl_(sdbx|live)_/.exec(env.paddleApiKey ?? "")?.[1];
  if (apiKeyEnv && (apiKeyEnv === "sdbx" ? "sandbox" : "live") !== paddleEnv)
    throw new PaymentsConfigError(
      `PADDLE_API_KEY is not a ${paddleEnv} key (PADDLE_ENV=${paddleEnv}).`,
    );
  const tokenEnv = /^(test|live)_/.exec(env.paddleClientToken ?? "")?.[1];
  if (tokenEnv && (tokenEnv === "test" ? "sandbox" : "live") !== paddleEnv)
    throw new PaymentsConfigError(
      `PADDLE_CLIENT_TOKEN is not a ${paddleEnv} token (PADDLE_ENV=${paddleEnv}).`,
    );

  return env;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Same rule as apps/web/lib/env.ts `isLocalAppUrl`; a missing or invalid URL is not local. */
export function isLocalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

let cached: PaymentsEnv | undefined;

export function paymentsEnv(): PaymentsEnv {
  cached ??= parsePaymentsEnv(process.env);
  return cached;
}

/** For tests that change the environment between cases. */
export function resetPaymentsEnv(): void {
  cached = undefined;
}
