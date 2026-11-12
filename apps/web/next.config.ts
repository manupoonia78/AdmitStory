import { withSentryConfig } from "@sentry/nextjs/config";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Next only reads .env files from apps/web. The repo keeps one .env.local at the root, so load it
// here, for `next dev`, `next build` and `next start` alike. Real environment variables win
// (dotenv never overrides), which is how CI and Vercel provide them.
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
loadEnv({ path: `${REPO_ROOT}.env.local`, quiet: true });

// Browser-side keys keep their Section 17 names (agreed with the owner), so they are inlined here
// at build time instead of being renamed with NEXT_PUBLIC_. Changing one needs a rebuild.
const BROWSER_ENV_KEYS = ["TURNSTILE_SITE_KEY", "POSTHOG_KEY", "POSTHOG_HOST", "SENTRY_DSN"];
const browserEnv = Object.fromEntries(
  BROWSER_ENV_KEYS.map((key) => [key, process.env[key]?.trim() ?? ""]),
);

// Security headers (spec §14.6, Phase 9b decision 21). The Content-Security-Policy is not here:
// proxy.ts builds it per request with a nonce, so each page response carries exactly one. HSTS
// gains `preload` only once the domain is final (docs/LAUNCH.md).
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), geolocation=(), microphone=(self), payment=(self "https://checkout.dodopayments.com" "https://test.checkout.dodopayments.com")',
  },
  // Payment wallets in Dodo's overlay and Google sign-in open popups that must be able to talk back.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

// The recommender portal (Phase 6 plan §8): a token in the path must never leak through a Referer
// header, a cache or a search engine. Listed after the global rule so these values win.
const PORTAL_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// packages/ai reads these at runtime (canon, prompt templates, replay fixtures), so they must be
// copied into every server trace that can reach ai.run(). The globs must be relative to apps/web:
// Next globs them from here and joins each match onto this directory, so an absolute pattern
// yields paths that do not exist and the files are silently left out of the deployment.
const AI_RUNTIME_FILES = [
  "../../knowledge/canon/*.md",
  "../../packages/ai/src/prompts/**/*.md",
  "../../fixtures/llm-replays/**/*.json",
  // Phase 9b's in-app eval scan: the baseline, the synthetic applicants and the compiled packs.
  "../../fixtures/evals/*.json",
  "../../fixtures/applicants/**/*",
  "../../packages/ai/scripts/samples/*.compiled.txt",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@admitstory/ai",
    "@admitstory/db",
    "@admitstory/emails",
    "@admitstory/shared",
    "@admitstory/ui",
    "@admitstory/voice",
  ],
  env: browserEnv,
  outputFileTracingRoot: REPO_ROOT,
  outputFileTracingIncludes: { "/**": AI_RUNTIME_FILES },
  turbopack: { root: REPO_ROOT },
  experimental: {
    // @admitstory/ui's index only re-exports, so each page bundles just the components it uses.
    optimizePackageImports: ["@phosphor-icons/react", "@admitstory/ui"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/r", headers: PORTAL_HEADERS },
      { source: "/r/:path*", headers: PORTAL_HEADERS },
      { source: "/api/r/:path*", headers: PORTAL_HEADERS },
    ];
  },
};

// Sentry's build wrapper only runs when there is something to report to or upload: without a DSN
// or an auth token it is skipped entirely, so local and CI builds are untouched.
const sentryEnabled = Boolean(process.env.SENTRY_DSN || process.env.SENTRY_AUTH_TOKEN);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: !process.env.CI,
      ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
      ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
      ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      telemetry: false,
    })
  : nextConfig;
