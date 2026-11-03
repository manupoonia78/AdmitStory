import { getDb, latestResumeReview } from "@admitstory/db";
import { z } from "zod";
import { ApiError, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { resumeDocx } from "@/lib/forms/export";
import { ownResumeReview } from "@/lib/forms/resume-view";

// POST /api/resume/export (spec §11, §5.10): the reviewed résumé as a Word file, made now from the
// review and the applicant's decisions and streamed back. Nothing is stored.

const Body = z.strictObject({});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("export", userId, { limit: 20, windowMs: 60_000 });
    await readJson(request, Body);
    const latest = await latestResumeReview(getDb(), userId);
    if (!latest) throw new ApiError(404, "There's no reviewed résumé to export yet.");
    const review = await ownResumeReview(userId, latest.id);
    const bytes = await resumeDocx(review.content, review.decisions, review.useSuggestedOrder);
    const name = (review.content.header.name ?? "resume")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name || "resume"}-resume.docx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
