import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest";
import { serverEnv } from "@/lib/env";

// Inngest calls this route to run functions (spec §7.4). Requests are signed with
// INNGEST_SIGNING_KEY; INNGEST_DEV=1 (localhost only) points the SDK at a local Dev Server and
// turns signature checks off.
const handler = serve({ client: inngest, functions });
type Handler = typeof handler.GET;

// Validate the environment on the first request (not at import, so `next build` needs no
// secrets): on any host but localhost it refuses dev mode and a missing signing key (fail closed).
function withValidEnv(run: Handler): Handler {
  return (request, context) => {
    serverEnv();
    return run(request, context);
  };
}

export const GET = withValidEnv(handler.GET);
export const POST = withValidEnv(handler.POST);
export const PUT = withValidEnv(handler.PUT);
