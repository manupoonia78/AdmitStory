import { getDb, getStudioSession, listFacts, listStories } from "@admitstory/db";
import { handle, notFound, requireUser } from "@/lib/api";
import { loadKnowledge } from "@/lib/studio/state";

// GET /api/studio/sessions/:id/events (spec §11): the Studio's live channel. Story cards appear on
// the shelf as the Extractor finds them, and the facts counter and coverage meter keep up (§5.2).
//
// Spec §7.3 publishes these on a Redis channel. Upstash is not configured and is not part of
// Phase 1, so this tails the database from a cursor instead: the Extractor runs in the turn's
// `after()` and writes rows, and this notices them. One query per tick against two small
// user-scoped indexes, and it stops the moment the client disconnects. It swaps to pub/sub when
// Redis arrives for the kit pipeline (see docs/phase-1.md).

/** How often to look for new material. Fast enough to feel live, slow enough to be cheap. */
const POLL_MS = 800;
/** Vercel caps a streaming function; the client reconnects, which EventSource does on its own. */
const MAX_STREAM_MS = 4 * 60_000;
const HEARTBEAT_MS = 20_000;

export const dynamic = "force-dynamic";
// A stream stays open while the work runs; Vercel ends a function at its maxDuration (Pro: 300 s).
export const maxDuration = 300;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session: auth } = await requireUser();
    const userId = auth.user.id;
    const { id } = await context.params;

    const db = getDb();
    const session = await getStudioSession(db, userId, id);
    if (!session) notFound("That session");

    const encoder = new TextEncoder();
    const startedAt = Date.now();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let open = true;
        const send = (event: string, data: unknown) => {
          if (!open) return;
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch {
            open = false;
          }
        };

        const close = () => {
          if (!open) return;
          open = false;
          try {
            controller.close();
          } catch {
            // Already closed by the client going away.
          }
        };

        request.signal.addEventListener("abort", close);

        // The cursor. A first connection starts at what the page already showed; a reconnect
        // (EventSource sends the last event id it saw) starts where the previous stream stopped,
        // so a story that landed in between still flies in rather than being skipped.
        const resumeFrom = Date.parse(request.headers.get("last-event-id") ?? "");
        const seenStories = new Set<string>();
        let cursor = Number.isFinite(resumeFrom) ? resumeFrom : 0;
        let factSignature = "";
        const signatureOf = (facts: Awaited<ReturnType<typeof listFacts>>) =>
          facts
            .map((fact) => `${fact.id}:${fact.status}:${fact.value}`)
            .sort()
            .join("|");

        const sendEvent = (event: string, data: unknown) => {
          if (!open) return;
          try {
            controller.enqueue(
              encoder.encode(
                `id: ${new Date(cursor).toISOString()}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
          } catch {
            open = false;
          }
        };

        const storyEvent = (story: Awaited<ReturnType<typeof listStories>>[number]) => ({
          id: story.id,
          code: story.code,
          nickname: story.nickname,
          era: story.era,
          context: story.context,
          traits: story.traits,
          status: story.status,
          sensitivity: story.sensitivity,
        });

        const progress = async () => {
          // Coverage and the counters are derived, so they are recomputed together.
          const knowledge = await loadKnowledge(userId);
          sendEvent("progress", {
            coverage: knowledge.coverage,
            factCount: knowledge.factCount,
            conflictCount: knowledge.conflictCount,
            storyCount: knowledge.stories.length,
          });
        };

        {
          const [stories, facts] = await Promise.all([
            listStories(db, userId),
            listFacts(db, userId),
          ]);
          const resumed = cursor > 0;
          for (const story of stories) {
            const at = story.createdAt.getTime();
            if (resumed && at > cursor) sendEvent("story", storyEvent(story));
            seenStories.add(story.id);
          }
          cursor = Math.max(cursor, Date.now());
          factSignature = signatureOf(facts);
          send("ready", { sessionId: id, stories: seenStories.size, facts: facts.length });
          // Always: whatever changed while the client was not listening shows straight away.
          await progress();
        }

        let lastBeat = Date.now();
        while (open) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (!open || request.signal.aborted) break;
          if (Date.now() - startedAt > MAX_STREAM_MS) {
            sendEvent("reconnect", {});
            break;
          }

          try {
            const polledAt = Date.now();
            const [stories, facts] = await Promise.all([
              listStories(db, userId),
              listFacts(db, userId),
            ]);

            const fresh = stories.filter((story) => !seenStories.has(story.id));
            const signature = signatureOf(facts);
            const factsChanged = signature !== factSignature;
            factSignature = signature;
            cursor = polledAt;

            if (fresh.length > 0 || factsChanged) {
              for (const story of fresh) {
                seenStories.add(story.id);
                sendEvent("story", storyEvent(story));
              }
              await progress();
            } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
              // Keeps proxies from closing an idle stream.
              controller.enqueue(encoder.encode(": keep-alive\n\n"));
              lastBeat = Date.now();
            }
          } catch (error) {
            console.error("[studio] events poll failed", error);
            send("error", { message: "The live updates stopped. Your answers are still saved." });
            break;
          }
        }

        close();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  });
}
