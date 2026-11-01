import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, requireUser } from "@/lib/api";
import { kitPreviewRequested } from "@/inngest/events";
import { dispatch } from "@/lib/strategy/dispatch";
import { runKitPreview, setPreviewJob } from "@/lib/strategy/jobs";
import { STRATEGY_LIMITS } from "@/lib/strategy/page-data";
import { loadPreviewState, previewBudget } from "@/lib/strategy/preview";

// GET/POST /api/user-schools/:id/preview (spec §11, §5.5): the free kit preview for one school on
// the caller's list. GET reports where it stands (the page polls it while one builds); POST asks
// for one. A school without a published pack is never previewed (409), a preview built from the
// current dossier snapshot is reused rather than paid for twice, and a spent free allowance is a
// `budget` state the page explains, not an error.

const Id = z.guid();

async function ownedId(context: { params: Promise<{ id: string }> }): Promise<string> {
  const parsed = Id.safeParse((await context.params).id);
  if (!parsed.success) notFound("That school");
  return parsed.data;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const id = await ownedId(context);
    const preview = await loadPreviewState(session.user.id, id);
    if (!preview) notFound("That school");
    return Response.json(preview);
  });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    const id = await ownedId(context);
    const preview = await loadPreviewState(userId, id);
    if (!preview) notFound("That school");
    const { state } = preview;
    if (state.state === "coming_soon")
      throw new ApiError(
        409,
        `${preview.schoolName}'s pack is coming soon. It can't be previewed yet.`,
      );
    // Already current, or already being built: nothing to start.
    if (
      (state.state === "ready" && !state.stale) ||
      state.state === "running" ||
      (state.state === "ready" && state.updating)
    )
      return Response.json(preview, { status: 200 });

    checkRateLimit("previewStart", userId, STRATEGY_LIMITS.previewStart);
    if ((await previewBudget(userId)) === "exceeded") {
      await setPreviewJob(userId, id, { state: "budget", at: new Date().toISOString() });
      return Response.json({ ...preview, state: { state: "budget" } });
    }
    const since = new Date().toISOString();
    await setPreviewJob(userId, id, { state: "running", at: since });
    await dispatch(kitPreviewRequested.create({ userId, userSchoolId: id }), async () => {
      try {
        await runKitPreview(userId, id);
      } catch (error) {
        await setPreviewJob(userId, id, { state: "failed", at: new Date().toISOString() });
        throw error;
      }
    });
    const next = await loadPreviewState(userId, id);
    return Response.json(next ?? { ...preview, state: { state: "running", since } }, {
      status: 202,
    });
  });
}
