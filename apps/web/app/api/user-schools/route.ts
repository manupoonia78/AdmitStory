import { addUserSchool, getDb, listUserSchools } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { profileReadRequested, strategyFitRequested } from "@/inngest/events";
import { runProfileRead } from "@/lib/profile-read/server";
import { dispatch } from "@/lib/strategy/dispatch";
import { runSchoolFit } from "@/lib/strategy/jobs";
import { STRATEGY_LIMITS } from "@/lib/strategy/page-data";

// GET/POST /api/user-schools (spec §11, §5.5): the caller's school list. Adding a school queues its
// fit (strategy.school_fit) and lets the Profile Read pick up the new target on its daily rule.
// Adding the same school-cycle twice returns the existing row, so a resend is harmless.

const Body = z.strictObject({
  schoolCycleId: z.guid(),
  round: z.string().trim().min(1).max(40).nullable().optional(),
  isReapplicant: z.boolean().optional(),
});

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const schools = await listUserSchools(getDb(), session.user.id);
    return Response.json({
      schools: schools.map((s) => ({
        id: s.id,
        schoolCycleId: s.schoolCycleId,
        school: s.school,
        cycle: { id: s.cycle.id, cycle: s.cycle.cycle },
        round: s.round,
        status: s.status,
        isReapplicant: s.isReapplicant,
        previousOutcome: s.previousOutcome,
      })),
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("strategyWrites", userId, STRATEGY_LIMITS.writes);
    const body = await readJson(request, Body);
    let row;
    try {
      row = await addUserSchool(getDb(), userId, body);
    } catch (error) {
      // A foreign-key failure: the school-cycle doesn't exist.
      if (error instanceof Error && /foreign key|violates/i.test(error.message))
        return Response.json({ error: "That school cycle could not be found." }, { status: 404 });
      throw error;
    }
    const userSchoolId = row.id;
    await dispatch(strategyFitRequested.create({ userId, userSchoolId }), () =>
      runSchoolFit(userId, userSchoolId),
    );
    await dispatch(profileReadRequested.create({ userId, reason: "schools_changed" }), () =>
      runProfileRead(userId, "schools_changed"),
    );
    return Response.json(
      {
        userSchool: {
          id: row.id,
          schoolCycleId: row.schoolCycleId,
          round: row.round,
          status: row.status,
          isReapplicant: row.isReapplicant,
        },
      },
      { status: 201 },
    );
  });
}
