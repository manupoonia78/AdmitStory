import { z } from "zod";
import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { buildResume } from "@/lib/resume/server";
import { NarrativeBody } from "@/lib/resume/schemas";
import { loadResumeWork } from "@/lib/resume/view";

// POST /api/resume/build: builds the applicant's résumé to tell their narrative, from the dossier,
// a pasted CV or their uploaded résumé. Replaces the current one; the chat can undo it.

const Body = z.strictObject({
  narrative: NarrativeBody,
  from: z.enum(["dossier", "pasted", "upload"]),
  pasted: z.string().max(40_000).optional(),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("resumeBuild", userId, { limit: 6, windowMs: 60_000 });
    const body = await readJson(request, Body);
    await buildResume(userId, {
      narrative: body.narrative,
      from: body.from,
      ...(body.pasted ? { pasted: body.pasted } : {}),
    });
    return Response.json(await loadResumeWork(userId));
  });
}
