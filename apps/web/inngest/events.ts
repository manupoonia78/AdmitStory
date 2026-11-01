import "server-only";

import { eventType } from "inngest";
import { z } from "zod";
import { inngestDevMode } from "../lib/env";
import { inngest, userCreated } from "./client";

/* Phase 3 events (spec §7.4, §9.3, §9.4) ------------------------------------------------------- */

/** An admin added a knowledge source (or asked to normalise it again): extract, embed, normalise. */
export const kbSourceAdded = eventType("kb/source.added", {
  schema: z.object({ sourceId: z.uuid() }),
});

/** An admin asked for the refresh checker to run now rather than on its schedule (§9.3). */
export const kbRefreshRequested = eventType("kb/refresh.requested", {
  schema: z.object({ reason: z.enum(["admin"]) }),
});

/** A pack version was published. School Strategy reads the newest published pack directly. */
export const kbPackPublished = eventType("kb/pack.published", {
  schema: z.object({ cycleId: z.guid(), version: z.int().positive() }),
});

/** A canon version was published: the eval suite runs from Phase 9 (§8.11); until then a no-op. */
export const evalsRun = eventType("evals/run", {
  schema: z.object({
    reason: z.enum(["canon_published", "prompt_activated"]),
    canonDocId: z.uuid().optional(),
    slug: z.string().max(80).optional(),
    version: z.int().positive().optional(),
  }),
});

/**
 * Build (or rebuild) the applicant's Profile Read (§5.4). `manual` is the applicant asking
 * (rate-limited at the route); the others are automatic and debounced to once a day by the function.
 */
export const PROFILE_READ_REASONS = [
  "manual",
  "dossier_changed",
  "schools_changed",
  "first_visit",
] as const;
export type ProfileReadReason = (typeof PROFILE_READ_REASONS)[number];

export const profileReadRequested = eventType("profile/read.requested", {
  schema: z.object({ userId: z.uuid(), reason: z.enum(PROFILE_READ_REASONS) }),
});

/** A school's fit for one applicant (§5.5), recomputed when the pack or dossier changes. */
export const strategyFitRequested = eventType("strategy/fit.requested", {
  schema: z.object({ userId: z.uuid(), userSchoolId: z.guid() }),
});

/** The free kit preview for one school (§5.5, decision 2026-10-31). */
export const kitPreviewRequested = eventType("kit/preview.requested", {
  schema: z.object({ userId: z.uuid(), userSchoolId: z.guid() }),
});

/* Phase 4 events (spec §5.6, §5.7, §7.4) ------------------------------------------------------- */

/**
 * Build a paid kit (§5.7), sent by the payments webhook once per purchase. `only` regenerates just
 * the named deliverables (a failed essay's retry); without it every unfinished stage runs.
 */
export const kitGenerate = eventType("kit/generate", {
  schema: z.object({
    kitId: z.guid(),
    userId: z.uuid(),
    only: z.array(z.guid()).max(40).optional(),
  }),
});

/** The applicant answered (or skipped) the kit's blocking gap questions; the pipeline resumes. */
export const kitGapsAnswered = eventType("kit/gaps.answered", {
  schema: z.object({ kitId: z.guid(), userId: z.uuid(), skipped: z.boolean() }),
});

/** Draft another angle (Option B or C) for one deliverable, on demand (§5.7 stage 6). */
export const kitDraftOption = eventType("kit/draft-option", {
  schema: z.object({ userId: z.uuid(), deliverableId: z.guid(), angleId: z.guid() }),
});

/** Facts or stories changed: mark the drafts that used them stale and re-run their checks (§5.3). */
export const checksRerun = eventType("checks/rerun", {
  schema: z.object({
    userId: z.uuid(),
    factCodes: z.array(z.string().max(12)).max(200).optional(),
    storyCodes: z.array(z.string().max(12)).max(200).optional(),
    reason: z.string().max(200),
  }),
});

/** True when events can be delivered (an event key, or the Dev Server). */
export function inngestReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return inngestConfigured(env);
}

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
