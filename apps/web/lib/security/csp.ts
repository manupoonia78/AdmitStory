// Content-Security-Policy (spec §14.6, Phase 9b decision 21). Built per request by proxy.ts with a
// fresh nonce; Next reads the nonce from the request's CSP header and stamps it on its own
// scripts. Every page renders dynamically (the root layout reads the theme cookie), so the
// marketing pages take the same nonce policy as the app instead of the static one the plan
// sketched. No 'strict-dynamic': it would ignore 'self', blob: and the host list that the
// capture worklet, Dodo's checkout and Turnstile load through.

export interface CspOptions {
  nonce: string;
  /** `next dev`: React needs eval for its debugging aids. */
  dev: boolean;
  /** APP_URL is http://localhost (dev, CI e2e, Lighthouse): allow local sockets, no https upgrade. */
  local: boolean;
  /** POSTHOG_HOST, when analytics is configured. */
  posthogHost?: string | undefined;
  /** Sentry's security endpoint, derived from SENTRY_DSN. */
  reportUri?: string | null | undefined;
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The CSP header value for a page. */
export function pageCsp({ nonce, dev, local, posthogHost, reportUri }: CspOptions): string {
  const posthog = originOf(posthogHost);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      // The capture AudioWorklet is a blob: module (packages/voice/src/client/capture.ts).
      "blob:",
      "https://challenges.cloudflare.com",
      // Dodo's overlay SDK is bundled, but it can add the wallet SDK from its own hosts.
      "https://*.dodopayments.com",
      // posthog-js lazy-loads its recorder and surveys from the assets host.
      "https://*.posthog.com",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://media.licdn.com"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      "https://api.deepgram.com",
      "wss://api.deepgram.com",
      "https://*.posthog.com",
      ...(posthog ? [posthog] : []),
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://*.ingest.de.sentry.io",
      "https://*.dodopayments.com",
      "https://challenges.cloudflare.com",
      // Local: HMR and the fake Deepgram server (FAKE_STT_URL, ws://localhost:8787).
      ...(local ? ["ws://localhost:*", "http://localhost:*", "ws://127.0.0.1:*"] : []),
    ],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    // Dodo's overlay is an iframe on checkout.dodopayments.com (test.checkout… in test mode).
    "frame-src": ["https://challenges.cloudflare.com", "https://*.dodopayments.com"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Upgrading on http://localhost would break the local server's own requests.
  if (!local) parts.push("upgrade-insecure-requests");
  if (reportUri) parts.push(`report-uri ${reportUri}`);
  return parts.join("; ");
}

/**
 * Sentry's CSP report endpoint for a DSN
 * (https://<key>@<host>/<project> → https://<host>/api/<project>/security/?sentry_key=<key>).
 */
export function sentryReportUri(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\//, "");
    if (!url.username || !project) return null;
    return `${url.protocol}//${url.host}/api/${project}/security/?sentry_key=${url.username}`;
  } catch {
    return null;
  }
}

/** A random nonce, base64, from 16 bytes. */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
