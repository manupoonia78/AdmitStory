import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { idParam, REFINE_LIMIT } from "@/lib/workspace/route";
import { draftContext, refineDraft } from "@/lib/workspace/server";

// POST /api/drafts/:id/refine (spec §11, §5.8, §8.6): a change asked in words or by voice. Only
// the targeted paragraphs change (util.classify picks them when none are given); locked and
// hand-edited paragraphs never do. Returns the new version and which paragraphs changed, for the
// diff review. Uses one of the kit's refinements; 10 a minute.

const Body = z.strictObject({
  instruction: z.string().trim().min(1).max(2_000),
  paragraphIds: z.array(z.string().min(1).max(100)).max(30).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("refine", session.user.id, REFINE_LIMIT);
    const ctx = await draftContext(session.user.id, await idParam(context, "id", "That draft"));
    const body = await readJson(request, Body);
    const result = await refineDraft(session.user.id, ctx, {
      instruction: body.instruction,
      ...(body.paragraphIds ? { paragraphIds: body.paragraphIds } : {}),
    });
    return Response.json({
      draft: result.draft,
      before: ctx.draft.content.paragraphs,
      changed: result.changed,
      summary: result.summary,
      over: result.over,
    });
  });
}
