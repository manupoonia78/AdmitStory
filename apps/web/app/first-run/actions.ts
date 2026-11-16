"use server";

import {
  addUserSchool,
  createSource,
  getDb,
  listSeedSchools,
  markFirstRunComplete,
  updateProfile,
  upsertFacts,
} from "@admitstory/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { strategyFitRequested } from "@/inngest/events";
import { captureServerEvent } from "@/lib/analytics/server";
import { requireOnboardedUser } from "@/lib/app-user";
import { dispatch } from "@/lib/strategy/dispatch";
import { runSchoolFit } from "@/lib/strategy/jobs";
import { HOMEPAGE_LINE_ORIGIN } from "@/lib/studio/homepage-line";

// First run (spec §5.1): five screens, about a minute, then straight into Story Studio.
//
// The schools they pick (16 Nov 2026) go on their list exactly as "Add schools" would put them
// there, fit queued and all. Only schools with a published pack are offered, and only those are
// accepted here, so an id from anywhere else is dropped rather than failing the whole first run.
//
// The one-line current role becomes a Fact Sheet fact rather than a profile column, so the
// interviewer confirms it in passing instead of asking for it again (§2 "tell it once", §5.2).
//
// The line said on our homepage, when the applicant kept it (plan §5 step 3), becomes a source
// like anything else they said: encrypted, and quoted back by Story Studio's first question.

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
  schoolCycleIds: z.array(z.guid()).max(20).default([]),
  firstLine: z
    .string()
    .trim()
    .min(1)
    .max(200)
    // One line: no control characters (lib/marketing/first-line.ts cleanLine).
    .regex(/^[^\u0000-\u001f\u007f-\u009f]+$/)
    .optional(),
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

  if (values.firstLine)
    await createSource(db, userId, {
      kind: "conversation_note",
      text: values.firstLine,
      meta: { origin: HOMEPAGE_LINE_ORIGIN },
    });

  let schoolsAdded = 0;
  if (values.schoolCycleIds.length > 0) {
    const offered = new Set(
      (await listSeedSchools(db)).flatMap((school) =>
        school.publishedPack && school.cycle ? [school.cycle.id] : [],
      ),
    );
    for (const schoolCycleId of new Set(values.schoolCycleIds)) {
      if (!offered.has(schoolCycleId)) continue;
      const row = await addUserSchool(db, userId, { schoolCycleId });
      schoolsAdded += 1;
      await captureServerEvent({
        distinctId: userId,
        event: "school_added",
        properties: { source: "first_run" },
      });
      await dispatch(strategyFitRequested.create({ userId, userSchoolId: row.id }), () =>
        runSchoolFit(userId, row.id),
      );
    }
  }

  await markFirstRunComplete(db, userId);
  await captureServerEvent({
    distinctId: userId,
    event: "first_run_completed",
    properties: { mode: values.studioMode, intake: values.targetIntake, schools: schoolsAdded },
  });

  redirect("/studio");
}
