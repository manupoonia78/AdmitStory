import { z } from "zod";
import { readJson } from "@/lib/api";
import {
  handlePortal,
  portalAccess,
  portalJson,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";
import { runPortalAssist } from "@/lib/portal/assist";
import { portalContext } from "@/lib/portal/view";

// POST /api/r/:token/assist (spec §5.11, decisions 2 and 20): organises the recommender's own
// notes into an answer, or — under a school that asks for no AI help, or by their own choice —
// plans one with them. It never adds a sentence the notes don't support.

const Body = z.strictObject({
  groupKey: z.string().trim().min(1).max(80),
  questionId: z.string().trim().min(1).max(80),
  mode: z.literal("coach").optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("assist", access.inviteId);
    const body = await readJson(request, Body);
    const loaded = await portalContext(access);
    const result = await runPortalAssist(loaded, {
      groupKey: body.groupKey,
      questionId: body.questionId,
      coach: body.mode === "coach",
    });
    return portalJson(result);
  });
}
