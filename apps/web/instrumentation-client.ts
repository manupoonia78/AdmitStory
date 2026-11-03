// Browser observability. SENTRY_DSN is inlined at build time (next.config.ts "env"); without it
// this file is empty after minification. With it, the SDK loads as its own chunk, so it never
// counts towards a route's first-load JavaScript (spec §6.9 budget).

type SentryModule = typeof import("@sentry/nextjs");
let sentry: SentryModule | undefined;

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  void import("./lib/observability/sentry-client").then(({ initSentryClient }) => {
    sentry = initSentryClient(dsn);
  });
}

export function onRouterTransitionStart(
  ...args: Parameters<SentryModule["captureRouterTransitionStart"]>
) {
  sentry?.captureRouterTransitionStart(...args);
}
