import { getDb, getResume } from "@admitstory/db";
import { ApiError, checkRateLimit, handle, requireUser } from "@/lib/api";
import { resumeDocx } from "@/lib/forms/export";
import { docAsReview } from "@/lib/resume/export";

// POST /api/resume/work/export: the working résumé as a Word file, in the same ATS-safe layout as
// the Résumé Pass export. Made now and streamed back; nothing is stored.

export async function POST(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    await checkRateLimit("export", session.user.id, { limit: 20, windowMs: 60_000 });
    const row = await getResume(getDb(), session.user.id);
    if (!row?.content) throw new ApiError(404, "Build your résumé first.");
    const bytes = await resumeDocx(docAsReview(row.content), {}, false);
    const name = (row.content.header.name ?? "resume")
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
