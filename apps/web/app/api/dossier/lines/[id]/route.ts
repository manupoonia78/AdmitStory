import { getDb, setGoldenLineStarred } from "@admitstory/db";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";

// PATCH /api/dossier/lines/:id — starring a golden line (spec §5.3b: "auto-selected, user can
// star/unstar"). Not in §11's route list, which has no route for it; see docs/phase-1.md.

const Body = z.object({ starred: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const { id } = await context.params;
    const { starred } = await readJson(request, Body);
    const line = await setGoldenLineStarred(getDb(), session.user.id, id, starred);
    if (!line) notFound("That line");
    return Response.json({ line });
  });
}
