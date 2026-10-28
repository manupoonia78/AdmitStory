import "server-only";

import { inngestDevMode } from "../lib/env";
import { inngest, userCreated } from "./client";

/** Upper bound on how long sign-up waits for Inngest before moving on. */
export const SEND_TIMEOUT_MS = 2_000;

function inngestConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  // Same reading of INNGEST_DEV as the SDK: "0" or "false" is cloud mode, which needs an event key.
  return Boolean(env.INNGEST_EVENT_KEY) || inngestDevMode(env.INNGEST_DEV);
}

/**
 * Emits "user/created". Never throws and never blocks sign-up for long: if Inngest is not
 * configured, unreachable or slow, the event is skipped and the reason is logged (without the
 * user's email). The profile and role are already written by then, so nothing is lost but the
 * analytics event.
 */
export async function emitUserCreated(userId: string): Promise<void> {
  if (!inngestConfigured()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${SEND_TIMEOUT_MS} ms`)),
        SEND_TIMEOUT_MS,
      );
    });
    await Promise.race([inngest.send(userCreated.create({ userId })), timeout]);
  } catch (error) {
    console.warn(
      "[inngest] user/created was not sent:",
      error instanceof Error ? error.message : "unknown error",
    );
  } finally {
    clearTimeout(timer);
  }
}
