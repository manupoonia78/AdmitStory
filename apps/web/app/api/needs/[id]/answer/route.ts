import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { idParam, REFINE_LIMIT } from "@/lib/workspace/route";
import { answerNeedAndFill } from "@/lib/workspace/server";

// POST /api/needs/:id/answer (spec §11, §5.8 NEED chips): the answer, by voice or text, goes to the
// dossier first; then only the paragraph the chip sits in is redrafted, as a new version.

const Body = z.strictObject({
  text: z.string().trim().min(1).max(4_000),
  via: z.enum(["voice", "text"]).default("text"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("needAnswer", session.user.id, REFINE_LIMIT);
    const id = await idParam(context, "id", "That question");
    const body = await readJson(request, Body);
    return Response.json(await answerNeedAndFill(session.user.id, id, body.text, body.via));
  });
}
