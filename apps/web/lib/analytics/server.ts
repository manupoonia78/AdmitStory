import "server-only";

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
  | "document_imported";

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

/** Sends one event and waits for it, so it survives the end of a serverless invocation. */
export const captureServerEvent: ServerCapture = async ({ distinctId, event, properties }) => {
  const ph = posthog();
  if (!ph) return;
  await ph.captureImmediate({ distinctId, event, ...(properties ? { properties } : {}) });
};
