import {
  UserSchoolLockedError,
  getDb,
  getUserSchool,
  removeUserSchool,
  updateUserSchool,
} from "@admitstory/db";
import { z } from "zod";
import {
  ApiError,
  badRequest,
  checkRateLimit,
  handle,
  notFound,
  readJson,
  requireUser,
} from "@/lib/api";
import { strategyFitRequested } from "@/inngest/events";
import { dispatch } from "@/lib/strategy/dispatch";
import { runSchoolFit } from "@/lib/strategy/jobs";
import { asPack, packRounds } from "@/lib/strategy/pack";
import { STRATEGY_LIMITS } from "@/lib/strategy/page-data";
import { latestPack } from "@/lib/strategy/server";

// PATCH/DELETE /api/user-schools/:id (spec §11, §5.5): the round, status, reapplicant flag and
// previous outcome of one school on the caller's list. Every statement is scoped to the caller:
// another applicant's id is "not found", never "forbidden", so ids can't be probed.

const Patch = z
  .strictObject({
    round: z.string().trim().min(1).max(40).nullable(),
    status: z.enum([
      "considering",
      "submitted",
      "interview",
      "admitted",
      "waitlisted",
      "denied",
      "withdrawn",
    ]),
    isReapplicant: z.boolean(),
    previousOutcome: z.string().trim().max(200).nullable(),
  })
  .partial();

const Id = z.guid();

async function ownedId(context: { params: Promise<{ id: string }> }): Promise<string> {
  const parsed = Id.safeParse((await context.params).id);
  if (!parsed.success) notFound("That school");
  return parsed.data;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("strategyWrites", userId, STRATEGY_LIMITS.writes);
    const id = await ownedId(context);
    const patch = await readJson(request, Patch);
    const db = getDb();
    const current = await getUserSchool(db, userId, id);
    if (!current) notFound("That school");

    // A round must be one the school's published pack lists (nothing unverified is planned on).
    if (patch.round) {
      const published = await latestPack(db, current.schoolCycleId);
      const rounds = published ? packRounds(asPack(published.data), "UTC") : [];
      if (!rounds.some((r) => r.short === patch.round))
        badRequest("Choose one of this school's published rounds.", [
          { path: "round", message: "Not a published round for this school" },
        ]);
    }

    const row = await updateUserSchool(db, userId, id, patch);
    if (!row) notFound("That school");
    // The round and reapplicant flag feed the fit's honest flags.
    if (patch.round !== undefined || patch.isReapplicant !== undefined)
      await dispatch(strategyFitRequested.create({ userId, userSchoolId: id }), () =>
        runSchoolFit(userId, id, { force: true }),
      );
    return Response.json({
      userSchool: {
        id: row.id,
        round: row.round,
        status: row.status,
        isReapplicant: row.isReapplicant,
        previousOutcome: row.previousOutcome,
      },
    });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("strategyWrites", session.user.id, STRATEGY_LIMITS.writes);
    const id = await ownedId(context);
    try {
      const removed = await removeUserSchool(getDb(), session.user.id, id);
      if (!removed) notFound("That school");
    } catch (error) {
      if (error instanceof UserSchoolLockedError)
        throw new ApiError(409, "An unlocked school stays on your list, with its kit and drafts.");
      throw error;
    }
    return Response.json({ removed: true });
  });
}
