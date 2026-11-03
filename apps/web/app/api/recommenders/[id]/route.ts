import {
  archiveRecommender,
  deleteWorkspacesForRecommender,
  getAccountIdentity,
  getDb,
  getInviteStatus,
  RecommenderPatch,
  revokeInvite,
  updateRecommender,
} from "@admitstory/db";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { ownRecommender, RECOMMENDER_WRITE_LIMIT } from "@/lib/recommenders/route";
import { loadRecommenderDetail } from "@/lib/recommenders/view";
import { idParam } from "@/lib/workspace/route";

// GET / PATCH / DELETE /api/recommenders/:id (spec §5.11, §11).
//
// Changing the address is the one patch that needs a confirmation (decision 8): the recommender's
// workspace is bound to their email, so a new address revokes the live link and deletes what the
// first person wrote, rather than handing it to whoever the new address belongs to.

const Body = RecommenderPatch.extend({ confirmEmailChange: z.literal(true).optional() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = await idParam(context, "id", "That recommender");
    const view = await loadRecommenderDetail(session.user.id, id);
    if (!view) notFound("That recommender");
    return Response.json(view);
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderWrites", userId, RECOMMENDER_WRITE_LIMIT);
    const id = await idParam(context, "id", "That recommender");
    const current = await ownRecommender(userId, id);
    const { confirmEmailChange, ...patch } = await readJson(request, Body);
    const db = getDb();

    const email = patch.email?.trim().toLowerCase();
    const changesEmail = email !== undefined && email !== current.email.toLowerCase();
    if (changesEmail) {
      const account = await getAccountIdentity(db, userId);
      if (account && email === account.email.toLowerCase())
        throw new ApiError(
          422,
          "That's your own address. A recommender's page is private to them, so it has to be theirs.",
        );
      const invite = await getInviteStatus(db, userId, id);
      if (invite && invite.status === "active" && !confirmEmailChange)
        throw new ApiError(
          409,
          `${current.name} has a live link at ${current.email}. Changing the address turns that link off and deletes anything written there.`,
        );
    }

    const row = await updateRecommender(db, userId, id, patch);
    if (!row) notFound("That recommender");
    if (changesEmail) {
      // The link and the workspace belong to the old address, and nobody else may inherit them.
      await revokeInvite(db, userId, id);
      await deleteWorkspacesForRecommender(db, userId, id);
    }
    return Response.json(await loadRecommenderDetail(userId, id));
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("recommenderWrites", userId, RECOMMENDER_WRITE_LIMIT);
    const id = await idParam(context, "id", "That recommender");
    const row = await archiveRecommender(getDb(), userId, id);
    if (!row) notFound("That recommender");
    return Response.json({ deleted: true });
  });
}
