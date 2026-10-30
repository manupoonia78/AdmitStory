import { getDb, resolveFactConflict } from "@admitstory/db";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";

// POST /api/dossier/facts/:id/resolve (spec §11, §5.3a): the one-tap answer to "You said a team of
// 11 earlier and 13 today. Which is current?". The value not chosen is kept on the row rather than
// thrown away, so the history of a correction survives.

const Body = z.object({ choice: z.enum(["current", "other"]) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const { id } = await context.params;
    const { choice } = await readJson(request, Body);
    const fact = await resolveFactConflict(getDb(), session.user.id, id, choice);
    if (!fact) notFound("That fact");
    return Response.json({ fact });
  });
}
