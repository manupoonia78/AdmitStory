// The speak demo's network side (plan §4, client half): Turnstile, rendered explicitly and
// invisibly inside the explainer, and the one-connection STT token from /api/demo/stt-token.
// Loaded with the hero experience, never in first load.

import type { SttTokenResponse } from "@admitstory/voice/contract";

/** Why the demo route refused (plan §4). Each maps to a notice in the hero. */
export type DemoRefusalReason = "paused" | "turnstile" | "rate_limited" | "unavailable";

export class DemoRefusal extends Error {
  constructor(readonly reason: DemoRefusalReason) {
    super(`demo refused: ${reason}`);
  }
}

const REASONS: readonly DemoRefusalReason[] = [
  "paused",
  "turnstile",
  "rate_limited",
  "unavailable",
];

function isToken(body: unknown): body is SttTokenResponse {
  if (typeof body !== "object" || body === null) return false;
  const record = body as Record<string, unknown>;
  return (
    typeof record.url === "string" &&
    Array.isArray(record.protocols) &&
    record.protocols.every((protocol) => typeof protocol === "string") &&
    typeof record.remainingSeconds === "number"
  );
}

/** POSTs for a token. Throws DemoRefusal with the route's reason; network failures are "unavailable". */
export async function fetchDemoToken(turnstileToken: string | null): Promise<SttTokenResponse> {
  let response: Response;
  try {
    response = await fetch("/api/demo/stt-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(turnstileToken ? { turnstileToken } : {}),
    });
  } catch {
    throw new DemoRefusal("unavailable");
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isToken(body)) return body;
  const reason = (body as { reason?: unknown } | null)?.reason;
  throw new DemoRefusal(
    REASONS.includes(reason as DemoRefusalReason) ? (reason as DemoRefusalReason) : "unavailable",
  );
}

// Turnstile (explicit render). The site key is inlined at build time; empty means no Turnstile
// (local development), and the route skips the check on a local APP_URL.

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: "interaction-only";
      size: "flexible";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY ?? "";
export const DEMO_ACTION = "hero_demo";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi | null> | null = null;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.append(script);
  });
  return loading;
}

export interface TurnstileHandle {
  /** The token, once the (usually invisible) challenge passes; null if it fails or isn't used. */
  token(): Promise<string | null>;
  remove(): void;
}

/** Renders the invisible challenge in `element`. Without a site key it resolves at once to null. */
export function renderTurnstile(element: HTMLElement): TurnstileHandle {
  if (!TURNSTILE_SITE_KEY) return { token: () => Promise.resolve(null), remove: () => {} };
  let settle: (token: string | null) => void = () => {};
  const result = new Promise<string | null>((resolve) => {
    settle = resolve;
  });
  let widget: string | null = null;
  let removed = false;
  void loadTurnstile().then((api) => {
    if (removed) return;
    if (!api) return settle(null);
    widget = api.render(element, {
      sitekey: TURNSTILE_SITE_KEY,
      action: DEMO_ACTION,
      appearance: "interaction-only",
      size: "flexible",
      callback: (token) => settle(token),
      "error-callback": () => settle(null),
      "expired-callback": () => settle(null),
    });
  });
  return {
    token: () => result,
    remove() {
      removed = true;
      if (widget !== null) window.turnstile?.remove(widget);
    },
  };
}

/** Whether this browser can capture audio at all (a secure context with getUserMedia). */
export function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window !== "undefined" &&
    ("AudioContext" in window || "webkitAudioContext" in window)
  );
}
