import { handle, requireUser } from "@/lib/api";
import { loadResumeWork } from "@/lib/resume/view";

// GET /api/resume/work: the Résumé page as it stands (narrative, document, chat).

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    return Response.json(await loadResumeWork(session.user.id));
  });
}
