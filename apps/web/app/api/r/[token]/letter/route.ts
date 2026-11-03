import { z } from "zod";
import { readJson } from "@/lib/api";
import { PORTAL_LIMITS } from "@admitstory/shared/kit";
import {
  handlePortal,
  portalAccess,
  portalJson,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";
import { savePortalLetter } from "@/lib/portal/assist";
import { portalContext, questionIn } from "@/lib/portal/view";

// PUT /api/r/:token/letter (spec §5.11, decision 2): what the recommender typed into one answer,
// saved as written. The product never writes a letter: this only stores theirs.

const Body = z.strictObject({
  groupKey: z.string().trim().min(1).max(80),
  questionId: z.string().trim().min(1).max(80),
  text: z.string().max(PORTAL_LIMITS.letterChars),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("letter", access.inviteId);
    const body = await readJson(request, Body);
    const loaded = await portalContext(access);
    const { group, question } = questionIn(loaded, body.groupKey, body.questionId);
    return portalJson(
      await savePortalLetter(access, loaded.workspace.letters, group, question, body.text),
    );
  });
}
