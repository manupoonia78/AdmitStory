import { z } from "zod";
import { badRequest, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";
import { loadThread, parseThread, sendMessage, type Thread } from "@/lib/chat/server";
import { REFINE_LIMIT } from "@/lib/workspace/route";

// GET /api/chat?thread=: one chat's turns, oldest first.
// POST /api/chat: sends one message. The change it asks for is made before this returns: an
// essay through the Reviser's paragraph patches, a form, a video plan or a brief through
// chat.revise, the résumé through resume.write. Uses one of the kit's refinements where the
// thread belongs to a kit; 10 a minute.

const Body = z.strictObject({
  thread: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2_000),
});

function threadOf(value: string | null): Thread {
  const thread = value ? parseThread(value) : null;
  if (!thread) badRequest("That chat could not be found.");
  return thread;
}

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const thread = threadOf(new URL(request.url).searchParams.get("thread"));
    return Response.json(await loadThread(session.user.id, thread));
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    await checkRateLimit("refine", session.user.id, REFINE_LIMIT);
    const body = await readJson(request, Body);
    return Response.json(await sendMessage(session.user.id, threadOf(body.thread), body.message));
  });
}
