import { z } from "zod";
import { badRequest, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { parseThread, undoMessage } from "@/lib/chat/server";
import { WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";

// POST /api/chat/undo: puts back exactly what one coach turn changed.

const Body = z.strictObject({
  thread: z.string().trim().min(1).max(200),
  messageId: z.guid(),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    await checkRateLimit("workspaceWrites", session.user.id, WORKSPACE_WRITE_LIMIT);
    const body = await readJson(request, Body);
    const thread = parseThread(body.thread);
    if (!thread) badRequest("That chat could not be found.");
    return Response.json(await undoMessage(session.user.id, thread, body.messageId));
  });
}
