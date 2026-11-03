import { z } from "zod";
import { handle, notFound, requireUser } from "@/lib/api";
import { loadKitView } from "@/lib/kit/view";

// GET /api/kits/:id/events (spec §11, §5.7): kit progress as server-sent events. There is no Redis
// (decision 2026-10-31), so like the Studio's channel this tails the database: each stage and draft
// is persisted as it finishes, and a changed view is sent whole. Closes when the kit settles or the
// client goes away; EventSource reconnects on its own after the platform's stream cap.

const POLL_MS = 1_000;
const MAX_STREAM_MS = 4 * 60_000;
const HEARTBEAT_MS = 20_000;

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    const id = z.guid().safeParse((await context.params).id);
    if (!id.success) notFound("That kit");
    const first = await loadKitView(userId, id.data);
    if (!first || first.status === "preview") notFound("That kit");
    const kitId = id.data;

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

        let last = JSON.stringify(first);
        send("kit", first);
        let lastBeat = Date.now();
        while (open && first.status !== "ready" && first.status !== "failed") {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (!open || request.signal.aborted) break;
          if (Date.now() - startedAt > MAX_STREAM_MS) {
            send("reconnect", {});
            break;
          }
          try {
            const view = await loadKitView(userId, kitId);
            if (!view) break;
            const json = JSON.stringify(view);
            if (json !== last) {
              last = json;
              send("kit", view);
              lastBeat = Date.now();
            }
            if (view.status === "ready" || view.status === "failed") break;
            if (Date.now() - lastBeat > HEARTBEAT_MS) {
              controller.enqueue(encoder.encode(": keep-alive\n\n"));
              lastBeat = Date.now();
            }
          } catch (error) {
            console.warn("[kit] progress read failed", error instanceof Error ? error.message : "");
          }
        }
        close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });
}
