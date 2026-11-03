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

        // The cursor starts at what the client already has: only new rows are sent.
        const seenStories = new Set<string>();
        const seenFacts = new Set<string>();
        for (const story of await listStories(db, userId)) seenStories.add(story.id);
        for (const fact of await listFacts(db, userId)) seenFacts.add(fact.id);
        send("ready", { sessionId: id, stories: seenStories.size, facts: seenFacts.size });

        let lastBeat = Date.now();
        while (open) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (!open || request.signal.aborted) break;
          if (Date.now() - startedAt > MAX_STREAM_MS) {
            send("reconnect", {});
            break;
          }

          try {
            const [stories, facts] = await Promise.all([
              listStories(db, userId),
              listFacts(db, userId),
            ]);

            const fresh = stories.filter((story) => !seenStories.has(story.id));
            const factsChanged = facts.some((fact) => !seenFacts.has(fact.id));

            if (fresh.length > 0 || factsChanged) {
              for (const story of fresh) {
                seenStories.add(story.id);
                send("story", {
                  id: story.id,
                  code: story.code,
                  nickname: story.nickname,
                  era: story.era,
                  context: story.context,
                  traits: story.traits,
                  status: story.status,
                  sensitivity: story.sensitivity,
                });
              }
              for (const fact of facts) seenFacts.add(fact.id);

              // Coverage and the counters are derived, so they are recomputed together.
              const knowledge = await loadKnowledge(userId);
              send("progress", {
                coverage: knowledge.coverage,
                factCount: knowledge.factCount,
                conflictCount: knowledge.conflictCount,
                storyCount: knowledge.stories.length,
              });
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
