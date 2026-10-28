import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry-options";

// Browser SDK without Session Replay: replay would add ~50 KB gz to every route (spec §6.9).
export function initSentryClient(dsn: string) {
  Sentry.init(sentryOptions(dsn));
  return Sentry;
}
