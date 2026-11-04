import {
  countThreadsStartedSince,
  getConnectPerson,
  getDb,
  listApplicantThreads,
  listGuideThreads,
  startConnectThread,
} from "@admitstory/db";
import { z } from "zod";
import {
  ApiError,
  RATE_LIMITS,
  checkRateLimit,
  handle,
  notFound,
  readJson,
  requireUser,
} from "@/lib/api";
import { captureServerEvent } from "@/lib/analytics/server";
import {
  CONNECT_MESSAGE_MAX,
  CONNECT_NEW_THREADS_PER_DAY,
  messageDto,
  requireConnect,
  threadDto,
} from "@/lib/connect/server";
import { assertFeatureOn } from "@/lib/features";

// GET  /api/connect/threads : the inbox. An applicant's conversations, and for a guide the ones
//                             they answer, newest first.
// POST /api/connect/threads : the first message to someone in the directory. With a guide the
//                             conversation opens at once; with anyone else it is an intro request.

export async function GET(): Promise<Response> {
  return handle(async () => {
    await assertFeatureOn("connect");
    const { session } = await requireUser();
    const userId = session.user.id;
    const access = await requireConnect(userId);
    const db = getDb();
    const [mine, answering] = await Promise.all([
      access.unlocked ? listApplicantThreads(db, userId) : [],
      access.guide ? listGuideThreads(db, userId) : [],
    ]);
    const threads = [
      ...mine.map((thread) => threadDto(thread, "applicant")),
      ...answering.map((thread) => threadDto(thread, "person")),
    ].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    return Response.json({ threads });
  });
}

const Body = z.object({
  personId: z.guid(),
  body: z.string().trim().min(1).max(CONNECT_MESSAGE_MAX),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await assertFeatureOn("connect");
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("connectMessages", userId, RATE_LIMITS.connectMessages);
    const access = await requireConnect(userId);
    if (!access.unlocked)
      throw new ApiError(
        402,
        "Starting a conversation comes with a school pack.",
        undefined,
        "connect_locked",
      );
    const body = await readJson(request, Body);
    const db = getDb();
    const person = await getConnectPerson(db, body.personId);
    if (!person) notFound("That person");

    const since = new Date(Date.now() - 24 * 60 * 60_000);
    if ((await countThreadsStartedSince(db, userId, since)) >= CONNECT_NEW_THREADS_PER_DAY)
      throw new ApiError(
        429,
        `You can start ${CONNECT_NEW_THREADS_PER_DAY} conversations a day. Your messages so far are saved; try again tomorrow.`,
      );

    const { thread, message, created } = await startConnectThread(db, userId, {
      personId: person.id,
      guide: person.guide,
      body: body.body,
    });
    if (created)
      await captureServerEvent({
        distinctId: userId,
        event: "connect_thread_started",
        properties: { relation: person.relation, guide: person.guide, school: person.school.slug },
      });
    return Response.json({ threadId: thread.id, message: messageDto(message, "applicant") });
  });
}
