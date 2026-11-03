// Cross-site request check for the API (Phase 9b decision 22). A state-changing /api request whose
// Origin names another host is refused. Webhooks, Inngest and Better Auth (which checks its own
// trusted origins) are exempt. A request without an Origin (curl, server-to-server) passes: the
// browser always sends one on a cross-site POST, and every route still checks the session.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PREFIXES = ["/api/webhooks/", "/api/inngest", "/api/auth/"];

export function crossSiteRefusal(input: {
  method: string;
  pathname: string;
  origin: string | null;
  host: string | null;
  /** APP_URL and SITE_URL hosts, which are always allowed. */
  allowedHosts?: readonly string[];
}): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;
  if (!input.pathname.startsWith("/api/")) return false;
  if (EXEMPT_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) return false;
  if (!input.origin) return false;
  let originHost: string;
  try {
    originHost = new URL(input.origin).host;
  } catch {
    // "null" (sandboxed frames, some redirects) or garbage.
    return true;
  }
  if (input.host && originHost === input.host) return false;
  return !(input.allowedHosts ?? []).includes(originHost);
}
