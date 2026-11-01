import { placeholdersIn } from "@admitstory/linters";
import { getDb, setBulletDecision } from "@admitstory/db";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { ownResumeReview } from "@/lib/forms/resume-view";
import { idParam, WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";

// PATCH /api/resume/review/:id/bullets/:bulletId (spec §5.10): keep the rewrite (with the answers
// to its `[?n]` placeholders), keep the original, or the applicant's own edit. Null undoes it.

const Decision = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("accepted"),
    answers: z.array(z.string().trim().min(1).max(200)).max(20),
  }),
  z.strictObject({ status: z.literal("rejected") }),
  z.strictObject({ status: z.literal("edited"), text: z.string().trim().min(1).max(600) }),
]);
const Body = z.strictObject({ decision: Decision.nullable() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; bulletId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("workspaceWrites", userId, WORKSPACE_WRITE_LIMIT);
    const review = await ownResumeReview(userId, await idParam(context, "id", "That review"));
    const bulletId = (await context.params).bulletId;
    const bullet = review.content.sections
      .flatMap((s) => s.roles.flatMap((r) => r.bullets))
      .find((b) => b.id === bulletId);
    if (!bullet) notFound("That bullet");
    const { decision } = await readJson(request, Body);
    if (decision?.status === "accepted") {
      if (!bullet.rewrite) throw new ApiError(409, "This line has no rewrite to keep.");
      // Every detail only the applicant knows has to be filled in: nothing is guessed (§0).
      if (decision.answers.length !== placeholdersIn(bullet.rewrite.text).length)
        throw new ApiError(422, "Answer each question in the rewrite before keeping it.");
    }
    const row = await setBulletDecision(getDb(), userId, review.id, bullet.id, decision);
    if (!row) notFound("That review");
    return Response.json({ decisions: row.decisions });
  });
}
