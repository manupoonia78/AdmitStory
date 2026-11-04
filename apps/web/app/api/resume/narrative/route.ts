import { checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { saveNarrative } from "@/lib/resume/server";
import { NarrativeBody } from "@/lib/resume/schemas";
import { WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";

// PUT /api/resume/narrative: saves the narrative the résumé tells, without rebuilding it.

export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    await checkRateLimit("workspaceWrites", session.user.id, WORKSPACE_WRITE_LIMIT);
    await saveNarrative(session.user.id, await readJson(request, NarrativeBody));
    return Response.json({ saved: true });
  });
}
