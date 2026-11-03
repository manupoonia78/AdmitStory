import { NextResponse, type NextRequest } from "next/server";
import { makeNonce, pageCsp, sentryReportUri } from "@/lib/security/csp";
import { crossSiteRefusal } from "@/lib/security/origin";

// Next 16's request hook (formerly middleware). Two jobs (Phase 9b decisions 21 and 22):
//   pages: a fresh nonce and the Content-Security-Policy, on the request (so Next stamps the nonce
//          on its own scripts) and on the response;
//   /api:  refuse a state-changing request from another site's page (403).
// It reads process.env directly rather than lib/env.ts, which validates the whole environment.

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const ALLOWED_HOSTS = [hostOf(process.env.APP_URL), hostOf(process.env.SITE_URL)].filter(
  (h): h is string => h !== null,
);
const DEV = process.env.NODE_ENV === "development";
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.APP_URL ?? "");
const REPORT_ONLY = process.env.CSP_REPORT_ONLY === "1";
const REPORT_URI = sentryReportUri(process.env.SENTRY_DSN);
const CSP_HEADER = REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const refused = crossSiteRefusal({
      method: request.method,
      pathname,
      origin: request.headers.get("origin"),
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      allowedHosts: ALLOWED_HOSTS,
    });
    if (refused)
      return NextResponse.json(
        { error: "This request came from another site, so we refused it." },
        { status: 403 },
      );
    return NextResponse.next();
  }

  const nonce = makeNonce();
  const csp = pageCsp({
    nonce,
    dev: DEV,
    local: LOCAL,
    posthogHost: process.env.POSTHOG_HOST,
    reportUri: REPORT_URI,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce from this request header, whichever mode the response uses.
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except build assets and files with an extension (icons, robots.txt, sitemap.xml).
    "/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
