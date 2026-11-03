import { getDb, mergeStories } from "@admitstory/db";
import { z } from "zod";
import {
  RATE_LIMITS,
  badRequest,
  checkRateLimit,
  handle,
  notFound,
  readJson,
  requireUser,
} from "@/lib/api";

// POST /api/dossier/stories/merge (spec §11, §5.3b). The merged story keeps its row and gains
// `merged_into`, so citations that already point at it still resolve.

const Body = z.object({ keep: z.guid(), merge: z.guid() });

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const body = await readJson(request, Body);
    if (body.keep === body.merge) badRequest("Pick two different stories to merge.");
    const story = await mergeStories(getDb(), session.user.id, body.keep, body.merge);
    if (!story) notFound("One of those stories");
    return Response.json({ story });
  });
}
