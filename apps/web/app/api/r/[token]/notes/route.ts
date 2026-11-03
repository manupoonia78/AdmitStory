import { z } from "zod";
import { readJson } from "@/lib/api";
import { PORTAL_LIMITS } from "@admitstory/shared/kit";
import { applyNoteOp } from "@/lib/portal/notes";
import {
  handlePortal,
  portalAccess,
  portalJson,
  portalLimit,
  tokenParam,
} from "@/lib/portal/access";
import { portalContext } from "@/lib/portal/view";
import { LanguageTag } from "@/lib/voice/schemas";

// POST /api/r/:token/notes (spec §5.11): the recommender's own notes, added, corrected or removed.
//
// A dictated note arrives as text and a count of seconds: no audio is kept (decision 5). The notes
// are the only material the page's assistant ever works from, and the applicant never sees them.

const Body = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("add"),
    text: z.string().max(PORTAL_LIMITS.noteChars),
    spoken: z
      .strictObject({
        seconds: z.number().int().min(0).max(PORTAL_LIMITS.voiceSeconds),
        language: LanguageTag,
      })
      .nullable()
      .optional(),
  }),
  z.strictObject({
    op: z.literal("update"),
    id: z.string().trim().min(1).max(8),
    text: z.string().max(PORTAL_LIMITS.noteChars),
  }),
  z.strictObject({ op: z.literal("delete"), id: z.string().trim().min(1).max(8) }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handlePortal(async () => {
    const access = await portalAccess(await tokenParam(context));
    await portalLimit("notes", access.inviteId);
    const body = await readJson(request, Body);
    const loaded = await portalContext(access);
    return portalJson({ notes: await applyNoteOp(access, loaded.workspace.notes, body) });
  });
}
