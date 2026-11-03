import { getDb } from "@admitstory/db";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { withIdempotency } from "@/lib/idempotency";
import { RECOMMENDER_WRITE_LIMIT, ownRecommender } from "@/lib/recommenders/route";
import {
  loadInviteView,
  reissueInvite,
  revokeInviteFor,
  scheduleInvite,
  sendInvite,
  type InviteFailure,
  type InviteOutcome,
} from "@/lib/reminders/invite";
import { idParam } from "@/lib/workspace/route";
import { assertFeatureOn } from "@/lib/features";

// GET / POST /api/recommenders/:id/invite (spec §5.11, decisions 3, 7 and 18).
//
// The response never carries the link (decision 7): it carries status and the preview text with
// "[your private link]" where the link goes. Sending or scheduling requires the hash of the
// preview the applicant has just read, so the words that go out are the words they saw.

const Body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("send"), previewHash: z.string().trim().length(64) }),
  z.strictObject({ action: z.literal("schedule"), previewHash: z.string().trim().length(64) }),
  z.strictObject({ action: z.literal("reissue") }),
  z.strictObject({ action: z.literal("revoke") }),
]);

const MESSAGES: Record<Exclude<InviteFailure, "not_found">, { status: number; text: string }> = {
  stale: {
    status: 409,
    text: "The invitation has changed since you read it. Read it once more and send it then.",
  },
  no_brief: {
    status: 422,
    text: "Build this recommender's brief first, so the invitation arrives with it.",
  },
  no_schools: { status: 422, text: "Tell us which schools this recommender writes for." },
  no_invite: { status: 422, text: "Nothing has been sent yet, so there's no link to replace." },
  not_scheduled: { status: 422, text: "There's no date to schedule: no deadline is known yet." },
};

function answer(outcome: InviteOutcome): { status: number; body: unknown } {
  if (outcome.ok) return { status: 200, body: outcome.view };
  if (outcome.reason === "not_found") notFound("That recommender");
  const { status, text } = MESSAGES[outcome.reason];
  throw new ApiError(status, text);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = await idParam(context, "id", "That recommender");
    const view = await loadInviteView(getDb(), session.user.id, id);
    if (!view) notFound("That recommender");
    return Response.json(view);
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderInvites", userId, RECOMMENDER_WRITE_LIMIT);
    const recommender = await ownRecommender(
      userId,
      await idParam(context, "id", "That recommender"),
    );
    const body = await readJson(request, Body);
    // Sending and reissuing email the recommender; scheduling and revoking don't (Phase 9b).
    if (body.action === "send" || body.action === "reissue")
      await assertFeatureOn("recommender_emails");
    const db = getDb();
    return withIdempotency(request, `recommenders.invite.${body.action}`, userId, async () => {
      switch (body.action) {
        case "send":
          return answer(await sendInvite(db, userId, recommender.id, body.previewHash));
        case "schedule":
          return answer(await scheduleInvite(db, userId, recommender.id, body.previewHash));
        case "reissue":
          return answer(await reissueInvite(db, userId, recommender.id));
        case "revoke":
          return answer(await revokeInviteFor(db, userId, recommender.id));
      }
    });
  });
}
