import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/observability/sentry-options";

// Loaded from instrumentation.ts only when SENTRY_DSN is set.
const dsn = process.env.SENTRY_DSN;
if (dsn) Sentry.init(sentryOptions(dsn));
