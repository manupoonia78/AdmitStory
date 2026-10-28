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

// Baseline security headers (spec §14.6). A full Content-Security-Policy (script/style/connect
// sources for Turnstile, PostHog, Sentry, Paddle and Cal.com) is a Phase 9 item; until then the
// policy only forbids framing.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

// packages/ai reads these at runtime (canon, prompt templates, replay fixtures), so they must be
// copied into every server trace that can reach ai.run().
const AI_RUNTIME_FILES = [
  `${REPO_ROOT}knowledge/canon/*.md`,
  `${REPO_ROOT}packages/ai/src/prompts/**/*.md`,
  `${REPO_ROOT}fixtures/llm-replays/**/*.json`,
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
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
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
