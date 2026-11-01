import { getDb, getKit } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { kitGapsAnswered } from "@/inngest/events";
import { answerNeed, openBlockingGaps } from "@/lib/kit/needs";
import { dispatch } from "@/lib/strategy/dispatch";

// POST /api/kits/:id/gaps/:gapId/answer (spec §11, §5.7 stage 4): the applicant answers a blocking
// gap question, by voice (dictated text) or typing. The answer is saved to the dossier first. When
// the last blocking question is answered the pipeline stops waiting and drafts.

const Body = z.strictObject({
  text: z.string().trim().min(1).max(4_000),
  via: z.enum(["voice", "text"]).default("text"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; gapId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("gapAnswers", userId, { limit: 30, windowMs: 60_000 });
    const params = await context.params;
    const ids = z.object({ id: z.guid(), gapId: z.guid() }).safeParse(params);
    if (!ids.success) notFound("That question");
    const kit = await getKit(getDb(), userId, ids.data.id);
    if (!kit || kit.status === "preview") notFound("That kit");
    const open = await openBlockingGaps(userId, kit.id);
    const gap = open.find((g) => g.id === ids.data.gapId);
    if (!gap) notFound("That question");
    const body = await readJson(request, Body);
    await answerNeed(userId, gap.id, body.text, { via: body.via, question: gap.question });
    const remaining = open.length - 1;
    if (remaining === 0)
      await dispatch(
        kitGapsAnswered.create({ kitId: kit.id, userId, skipped: false }),
        async () => {},
      );
    return Response.json({ answered: gap.id, remaining });
  });
}
