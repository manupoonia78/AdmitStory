"use server";

import { getDb, markFirstRunComplete, updateProfile, upsertFacts } from "@admitstory/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { captureServerEvent } from "@/lib/analytics/server";
import { requireOnboardedUser } from "@/lib/app-user";

// First run (spec §5.1): four screens, under a minute, then straight into Story Studio.
//
// The one-line current role becomes a Fact Sheet fact rather than a profile column, so the
// interviewer confirms it in passing instead of asking for it again (§2 "tell it once", §5.2).

const Input = z.object({
  targetIntake: z.coerce.number().int().min(2026).max(2035),
  programType: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,39}$/),
  targetRounds: z.array(z.enum(["R1", "R2", "R3", "R4", "rolling", "unsure"])).max(4),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  timezone: z.string().trim().min(1).max(64),
  currentRole: z.string().trim().max(200),
  studioMode: z.enum(["express", "standard", "deep"]),
});

export type FirstRunInput = z.input<typeof Input>;

export interface FirstRunState {
  error?: string;
}

export async function completeFirstRun(input: FirstRunInput): Promise<FirstRunState> {
  const { session } = await requireOnboardedUser("action");
  const userId = session.user.id;

  const parsed = Input.safeParse(input);
  if (!parsed.success)
    return { error: "Some of those answers didn't save. Check them and try again." };
  const values = parsed.data;

  const db = getDb();
  await updateProfile(db, userId, {
    targetIntake: values.targetIntake,
    programType: values.programType,
    targetRounds: values.targetRounds,
    country: values.country,
    timezone: values.timezone,
    studioMode: values.studioMode,
  });

  if (values.currentRole !== "")
    await upsertFacts(db, userId, [
      {
        key: "role_current_summary",
        value: values.currentRole,
        // They typed it themselves, so it is theirs to confirm, not ours to assume.
        status: "needs_confirmation",
      },
    ]);

  await markFirstRunComplete(db, userId);
  await captureServerEvent({
    distinctId: userId,
    event: "first_run_completed",
    properties: { mode: values.studioMode, intake: values.targetIntake },
  });

  redirect("/studio");
}
