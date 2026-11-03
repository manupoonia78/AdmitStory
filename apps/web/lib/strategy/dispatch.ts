import "server-only";

import { after } from "next/server";
import { inngest } from "@/inngest/client";
import { inngestDevMode } from "@/lib/env";

// Sends a Phase 3 job to Inngest, or, where Inngest isn't configured (local development without
// the Dev Server), runs it after the response instead, so the screens still work end to end. Never
// throws: a job that could not be queued is logged, and the page's own state shows it didn't run.

/** Same reading of INNGEST_DEV as the SDK and inngest/events.ts. */
export function inngestConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.INNGEST_EVENT_KEY) || inngestDevMode(env.INNGEST_DEV);
}

type InngestEvent = Parameters<typeof inngest.send>[0];

export async function dispatch(event: InngestEvent, inline: () => Promise<unknown>): Promise<void> {
  if (inngestConfigured()) {
    try {
      await inngest.send(event);
      return;
    } catch (error) {
      console.warn(
        "[strategy] event not sent, running inline:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }
  after(async () => {
    try {
      await inline();
    } catch (error) {
      console.error(
        "[strategy] inline job failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  });
}
