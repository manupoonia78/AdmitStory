import { getDb, getProfile } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { ruleOf } from "@/lib/kit/pipeline";
import { portalCopy, toDocx, toPdf } from "@/lib/workspace/export";
import { idParam } from "@/lib/workspace/route";
import { draftContext } from "@/lib/workspace/server";

// POST /api/drafts/:id/export (spec §11, §5.8): "Copy for portal" text with its verified count, or
// a DOCX or PDF made now and streamed back. Nothing is stored.

const Body = z.strictObject({ format: z.enum(["copy", "docx", "pdf"]) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("export", session.user.id, { limit: 20, windowMs: 60_000 });
    const ctx = await draftContext(session.user.id, await idParam(context, "id", "That draft"));
    const { format } = await readJson(request, Body);
    const profile = await getProfile(getDb(), session.user.id);
    const input = {
      title: ctx.deliverable.title ?? ctx.deliverable.packKey,
      prompt: ctx.deliverable.promptText,
      paragraphs: ctx.draft.content.paragraphs.map((p) => p.sentences.map((s) => s.text).join(" ")),
      author: profile?.displayName ?? session.user.name ?? "",
      school: ctx.kit.school.name,
      rule: ruleOf(ctx.deliverable),
    };
    if (format === "copy") return Response.json(portalCopy(input));
    const name = `${ctx.kit.school.slug}-${(input.title || "draft").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const bytes = format === "docx" ? await toDocx(input) : await toPdf(input);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type":
          format === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
