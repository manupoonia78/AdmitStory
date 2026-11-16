import "server-only";

import { after } from "next/server";
import { PostHog } from "posthog-node";
import { serverEnv } from "../env";

// Server-side product events (spec §15). Events carry ids and small enums only: no email, no
// essay or transcript text (spec §14.4). Without POSTHOG_KEY every call is a no-op.

/** Spec §15 product events; add names here as features ship. */
export type ProductEvent =
  | "signup_completed"
  // Phase 1 (Story Studio and the Dossier).
  | "first_run_completed"
  | "studio_started"
  | "studio_turn"
  | "story_detected"
  | "studio_session_ended"
  | "document_imported"
  // Connect (2026-11-04).
  | "connect_thread_started"
  // The path to a purchase (2026-11-16), in the order an applicant meets it. /admin/funnel counts
  // the same steps from the database; these add the page views and the timing between them.
  | "school_added"
  | "profile_read_viewed"
  | "preview_viewed"
  | "preview_requested"
  | "studio_limit_reached"
  | "unlock_viewed"
  | "checkout_opened"
  | "purchase_completed"
  | "credit_redeemed";

export type EventProperties = Record<string, string | number | boolean | null>;

export interface ServerCapture {
  (args: { distinctId: string; event: ProductEvent; properties?: EventProperties }): Promise<void>;
}

const DEFAULT_HOST = "https://us.i.posthog.com";

let client: PostHog | null | undefined;

function posthog(): PostHog | null {
  if (client !== undefined) return client;
  const env = serverEnv();
  client = env.POSTHOG_KEY
    ? new PostHog(env.POSTHOG_KEY, {
        host: env.POSTHOG_HOST ?? DEFAULT_HOST,
        // Serverless: send each event straight away rather than batching.
        flushAt: 1,
        flushInterval: 0,
        disableGeoip: true,
      })
    : null;
  return client;
}

/**
 * A page view, sent after the response so it never slows the page (next/server `after`). For
 * server components; routes and actions that already do work call captureServerEvent directly.
 */
export function capturePageEvent(args: Parameters<ServerCapture>[0]): void {
  if (!posthog()) return;
  after(() => captureServerEvent(args).catch(() => undefined));
}

/** Sends one event and waits for it, so it survives the end of a serverless invocation. */
export const captureServerEvent: ServerCapture = async ({ distinctId, event, properties }) => {
  const ph = posthog();
  if (!ph) return;
  await ph.captureImmediate({ distinctId, event, ...(properties ? { properties } : {}) });
};
