import { z } from "zod";
import { ApiError, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { ai } from "@/lib/ai";
import { ResumeLockedError, reviewLatestResume } from "@/lib/forms/resume";
import { loadResumeView } from "@/lib/forms/resume-view";

// GET /api/resume/review: the Résumé page's view. POST: reviews the newest uploaded résumé (spec
// §11, §5.10). Idempotent per upload: a résumé that already has a review returns it, so a double
// click never pays twice. The Résumé Pass is per applicant and comes with any active kit.

const Body = z.strictObject({});

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    return Response.json(await loadResumeView(session.user.id));
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("resumeReview", userId, { limit: 5, windowMs: 60_000 });
    await readJson(request, Body);
    const result = await reviewLatestResume(ai(), userId).catch((error: unknown) => {
      if (error instanceof ResumeLockedError) throw new ApiError(402, error.message);
      throw error;
    });
    if (!result) throw new ApiError(409, "Upload your résumé first, then we'll read it.");
    return Response.json(await loadResumeView(userId), { status: result.fresh ? 201 : 200 });
  });
}
