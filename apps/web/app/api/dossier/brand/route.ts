import { BrandPatch, getBrand, getDb, saveBrand } from "@admitstory/db";
import { RATE_LIMITS, checkRateLimit, handle, readJson, requireUser } from "@/lib/api";

// GET/PATCH /api/dossier/brand (spec §11, §5.3c). The Strategist proposes traits with their
// evidence; the applicant accepts or edits them, and a PATCH records a new version marked accepted
// so the Consolidator stops proposing over the top of their choice.

export async function GET(): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const brand = await getBrand(getDb(), session.user.id);
    return Response.json({ brand });
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("dossierWrites", session.user.id, RATE_LIMITS.dossierWrites);
    const patch = await readJson(request, BrandPatch);
    const brand = await saveBrand(getDb(), session.user.id, { ...patch, accepted: true });
    return Response.json({ brand });
  });
}
