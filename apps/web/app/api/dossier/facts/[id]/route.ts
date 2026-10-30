import { FactPatch, getDb, getFact, updateFact } from "@admitstory/db";
import { RATE_LIMITS, checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";

// GET/PATCH /api/dossier/facts/:id (spec §11). The Fact Sheet is the single source of truth, so
// every field an applicant can correct is editable here — including the approved phrasing every
// later draft must use (§5.3a).

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const { id } = await context.params;
    const fact = await getFact(getDb(), session.user.id, id);
    if (!fact) notFound("That fact");
    return Response.json({ fact });
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const { id } = await context.params;
    const patch = await readJson(request, FactPatch);
    const fact = await updateFact(getDb(), session.user.id, id, patch);
    if (!fact) notFound("That fact");
    return Response.json({ fact });
  });
}
