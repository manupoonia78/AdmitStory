import {
  consumeEntitlement,
  getDb,
  getFormAdvice,
  getLatestSnapshot,
  releaseEntitlement,
} from "@admitstory/db";
import { ApiError, checkRateLimit, handle, requireUser } from "@/lib/api";
import { ai } from "@/lib/ai";
import { adviseForms } from "@/lib/forms/advise";
import { ensureFormAdvice, formKitContext } from "@/lib/forms/view";
import { load } from "@/lib/kit/pipeline";
import { idParam, REFINE_LIMIT } from "@/lib/workspace/route";

// POST /api/kits/:id/forms/refresh (spec §11, §5.10): writes the school's form advice again from
// the current Dossier. It costs one of the kit's refinements, and only when the Dossier has changed
// since the advice was written; asking again for the same Dossier returns what is there, free.
// The applicant's own edits to entries are kept.

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("refine", userId, REFINE_LIMIT);
    const kit = await formKitContext(userId, await idParam(context, "id", "That kit"));
    const db = getDb();
    const [advice, latest] = await Promise.all([
      getFormAdvice(db, userId, kit.kit.id),
      getLatestSnapshot(db, userId),
    ]);
    if (!advice) {
      // A kit built before the Form Advisor: its first advice comes with the kit, free.
      const row = await ensureFormAdvice(userId, kit);
      return Response.json({ refreshed: true, version: row.version });
    }
    if (latest && latest.version <= advice.dossierSnapshotVersion)
      return Response.json({ refreshed: false, version: advice.version });

    const counter = { refId: kit.schoolCycleId, counter: "revisions" } as const;
    const used = await consumeEntitlement(db, userId, counter);
    if (!used.ok)
      throw new ApiError(
        402,
        used.reason === "limit_reached"
          ? `You've used all ${used.limit} refinements for this kit.`
          : `Your access to the ${kit.school.name} kit has ended.`,
      );
    try {
      const deps = { ai: ai(), db };
      const ref = { kitId: kit.kit.id, userId };
      const { row } = await adviseForms(deps, ref, await load(deps, ref));
      return Response.json({ refreshed: true, version: row?.version ?? null });
    } catch (error) {
      // Nothing changed, so the refinement isn't spent.
      await releaseEntitlement(db, userId, counter);
      throw error;
    }
  });
}
