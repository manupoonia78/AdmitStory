import { z } from "zod";
import { ApiError, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { briefFileName, briefPdf, briefText } from "@/lib/brief-export";
import { ownRecommender } from "@/lib/recommenders/route";
import { loadBriefView } from "@/lib/recommenders/view";
import { idParam } from "@/lib/workspace/route";

// POST /api/recommenders/:id/brief/export (spec §5.11): the brief as a PDF to attach, or the same
// words as text to paste into an email. Made now from the stored brief; nothing is kept.
//
// Both are written for the recommender: no cite codes, the questions verbatim, and the own-words
// reminder in the brief itself.

const Body = z.strictObject({
  group: z.string().trim().min(1).max(80),
  format: z.enum(["pdf", "text"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("export", userId, { limit: 20, windowMs: 60_000 });
    const recommender = await ownRecommender(
      userId,
      await idParam(context, "id", "That recommender"),
    );
    const { group, format } = await readJson(request, Body);
    const view = await loadBriefView(userId, recommender.id, group);
    if (!view) notFound("That brief");
    if (!view.brief || !view.meta)
      throw new ApiError(409, "Build this brief first, and you can send it on.");

    if (format === "text") return Response.json({ text: briefText(view.brief, view.meta) });
    const bytes = await briefPdf(view.brief, view.meta);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${briefFileName(view.meta, "pdf")}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
