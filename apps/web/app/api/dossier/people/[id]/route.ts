import { getDb, setPersonMayName } from "@admitstory/db";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";

// PATCH /api/dossier/people/:id — the per-person "may I name them?" choice (spec §5.3b, §8.7: a
// name reaches a draft only when this is true). Not in §11's route list; see docs/phase-1.md.

const Body = z.object({ mayName: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const { id } = await context.params;
    const { mayName } = await readJson(request, Body);
    const person = await setPersonMayName(getDb(), session.user.id, id, mayName);
    if (!person) notFound("That person");
    return Response.json({ person });
  });
}
