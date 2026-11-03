import { feedbackTargetMeta, getDb, recordFeedback } from "@admitstory/db";
import { FeedbackInput } from "@admitstory/shared/schemas";
import { checkRateLimit, handle, notFound, readJson, requireUser, RATE_LIMITS } from "@/lib/api";
import { raiseAdminAlert } from "@/lib/alerts";

// POST /api/feedback (spec §15, Phase 9b decision 24): a thumbs up or down on a Workspace draft,
// the Profile Read or the résumé pass, with a reason and an optional note for our team. The target
// must be the applicant's own (else 404). "This isn't true" is investigated as a sev-2 (§15), so it
// raises an admin alert. 20 an hour.

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("feedback", userId, RATE_LIMITS.feedback);
    const body = await readJson(request, FeedbackInput);
    const db = getDb();
    const meta = await feedbackTargetMeta(db, userId, body.targetType, body.targetId);
    if (!meta) notFound("That item");
    const row = await recordFeedback(db, userId, {
      targetType: body.targetType,
      targetId: body.targetId,
      rating: body.rating,
      reason: body.rating === -1 ? (body.reason ?? null) : null,
      text: body.text || null,
      meta,
    });
    if (body.rating === -1 && body.reason === "not_true")
      await raiseAdminAlert({
        kind: "not_true_report",
        key: `not_true_report:${row.id}`,
        severity: "warn",
        title: "An applicant reported something untrue",
        detail: { feedbackId: row.id, targetType: body.targetType, ...meta },
      });
    return Response.json({ id: row.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
