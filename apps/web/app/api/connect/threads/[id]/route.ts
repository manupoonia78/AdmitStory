import {
  addConnectMessage,
  getDb,
  getThreadForViewer,
  listConnectMessages,
  markConnectThreadRead,
} from "@admitstory/db";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { CONNECT_MESSAGE_MAX, messageDto, requireConnect } from "@/lib/connect/server";
import { assertFeatureOn } from "@/lib/features";
import { idParam } from "@/lib/workspace/route";

// GET  /api/connect/threads/:id?after=ISO : the conversation's messages (only newer ones with
//                                           `after`, which is how the open chat polls), and marks
//                                           it read for the viewer.
// POST /api/connect/threads/:id           : a reply, from either side.

type Ctx = { params: Promise<{ id: string }> };

async function viewerThread(context: Ctx) {
  await assertFeatureOn("connect");
  const { session } = await requireUser();
  const userId = session.user.id;
  await requireConnect(userId);
  const id = await idParam(context, "id", "That conversation");
  const found = await getThreadForViewer(getDb(), userId, id);
  if (!found) notFound("That conversation");
  return { userId, ...found };
}

export async function GET(request: Request, context: Ctx): Promise<Response> {
  return handle(async () => {
    const { thread, side } = await viewerThread(context);
    const after = z.iso
      .datetime()
      .optional()
      .catch(undefined)
      .parse(new URL(request.url).searchParams.get("after") ?? undefined);
    const db = getDb();
    const messages = await listConnectMessages(db, thread.id, after ? new Date(after) : undefined);
    if (messages.length > 0) await markConnectThreadRead(db, thread.id, side);
    return Response.json({
      status: thread.status,
      messages: messages.map((message) => messageDto(message, side)),
    });
  });
}

const Body = z.object({ body: z.string().trim().min(1).max(CONNECT_MESSAGE_MAX) });

export async function POST(request: Request, context: Ctx): Promise<Response> {
  return handle(async () => {
    const { userId, thread, side } = await viewerThread(context);
    await checkRateLimit("connectMessages", userId, RATE_LIMITS.connectMessages);
    const body = await readJson(request, Body);
    const message = await addConnectMessage(getDb(), thread.id, {
      side,
      authorUserId: userId,
      body: body.body,
    });
    return Response.json({ message: messageDto(message, side) });
  });
}
