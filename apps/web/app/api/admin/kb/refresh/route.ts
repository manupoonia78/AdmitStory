import { inngest } from "@/inngest/client";
import { inngestReady, kbRefreshRequested } from "@/inngest/events";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/kb/refresh (spec §5.18 "schedule refresh checks"): runs the refresh checker now
// rather than waiting for its schedule. It needs Inngest: the run fetches every official URL.
export const POST = adminRoute(async () => {
  if (!inngestReady())
    return Response.json(
      { error: "The refresh check runs on Inngest, which isn't configured here." },
      { status: 503 },
    );
  await inngest.send(kbRefreshRequested.create({ reason: "admin" }));
  return Response.json({ queued: true }, { status: 202 });
});
