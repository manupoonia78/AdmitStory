import {
  PRODUCT_SCHOOLS,
  PaymentsConfigError,
  type DodoEnvironment,
  type ProductKind,
} from "./provider";

// The payments environment (spec §17). Read on first use, never at import time. Parsed by hand, as
// packages/voice does: these are a handful of optional strings.
//
// Missing Dodo keys are not an error: local development runs on the fake provider, which
// select.ts picks when APP_URL is localhost. A half-configured Dodo is an error, because it would
// otherwise fall back to the fake without anyone noticing.

export interface PaymentsEnv {
  appUrl: string | undefined;
  dodoEnv: DodoEnvironment;
  dodoApiKey: string | undefined;
  /** The webhook endpoint's signing secret (`whsec_…`). */
  dodoWebhookKey: string | undefined;
  /** Dodo product ids (`pdt_…`), one one-time product per kind. */
  dodoProducts: Partial<Record<ProductKind, string>>;
}

/** The variable naming each kind's Dodo product. */
export const DODO_PRODUCT_ENV: Record<ProductKind, string> = {
  school_kit: "DODO_PRODUCT_SCHOOL_KIT",
  school_pack5: "DODO_PRODUCT_PACK5",
  school_pack10: "DODO_PRODUCT_PACK10",
};

const KINDS = Object.keys(PRODUCT_SCHOOLS) as ProductKind[];

const value = (raw: string | undefined): string | undefined => {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
};

export function parsePaymentsEnv(source: Record<string, string | undefined>): PaymentsEnv {
  const rawEnv = value(source.DODO_PAYMENTS_ENVIRONMENT)?.toLowerCase() ?? "test_mode";
  // Accept the overlay SDK's spelling ("test" / "live") too.
  const dodoEnv = rawEnv === "test" ? "test_mode" : rawEnv === "live" ? "live_mode" : rawEnv;
  if (dodoEnv !== "test_mode" && dodoEnv !== "live_mode")
    throw new PaymentsConfigError(
      `DODO_PAYMENTS_ENVIRONMENT must be "test_mode" or "live_mode", not "${rawEnv}".`,
    );

  const dodoProducts: Partial<Record<ProductKind, string>> = {};
  for (const kind of KINDS) {
    const id = value(source[DODO_PRODUCT_ENV[kind]]);
    if (!id) continue;
    if (!id.startsWith("pdt_"))
      throw new PaymentsConfigError(`${DODO_PRODUCT_ENV[kind]} must be a Dodo product id (pdt_…).`);
    dodoProducts[kind] = id;
  }

  const env: PaymentsEnv = {
    appUrl: value(source.APP_URL),
    dodoEnv,
    dodoApiKey: value(source.DODO_PAYMENTS_API_KEY),
    dodoWebhookKey: value(source.DODO_PAYMENTS_WEBHOOK_KEY),
    dodoProducts,
  };

  const required = [
    ["DODO_PAYMENTS_API_KEY", env.dodoApiKey],
    ["DODO_PAYMENTS_WEBHOOK_KEY", env.dodoWebhookKey],
    ...KINDS.map((kind) => [DODO_PRODUCT_ENV[kind], dodoProducts[kind]] as const),
  ] as const;
  const missing = required.filter(([, set]) => !set).map(([name]) => name);
  if (missing.length > 0 && missing.length < required.length)
    throw new PaymentsConfigError(
      `Set every Dodo variable or none of them. Missing: ${missing.join(", ")}.`,
    );
  if (env.dodoWebhookKey && !env.dodoWebhookKey.startsWith("whsec_"))
    throw new PaymentsConfigError("DODO_PAYMENTS_WEBHOOK_KEY must be a signing secret (whsec_…).");

  // Test keys carry a `dodo_test_` prefix. A test key against the live API (or the reverse) fails
  // with an opaque 401, so catch the mix-up here. Keys without a known prefix pass.
  const keyEnv = /^dodo_(test|live)_/.exec(env.dodoApiKey ?? "")?.[1];
  if (keyEnv && `${keyEnv}_mode` !== dodoEnv)
    throw new PaymentsConfigError(
      `DODO_PAYMENTS_API_KEY is a ${keyEnv} key, but DODO_PAYMENTS_ENVIRONMENT is ${dodoEnv}.`,
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
