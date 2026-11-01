import { dismissFinding, getDb, restoreFinding } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, notFound, readJson, requireUser } from "@/lib/api";
import { consistencyReport } from "@/lib/forms/consistency";
import { applyExpected } from "@/lib/forms/fix";
import { formKitContext } from "@/lib/forms/view";
import { WORKSPACE_WRITE_LIMIT } from "@/lib/workspace/route";

// GET /api/consistency?kitId= (spec §11, §5.10): every mismatch across the résumé, the form
// entries and the essays, for one kit or all of them. Recomputed on every read (pure code).
// POST: "Use “13” here" on one value, or "These are different things" (and its undo).

const FindingId = z.string().trim().min(1).max(120);
const Body = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("use_expected"),
    findingId: FindingId,
    docId: z.string().trim().min(1).max(200),
    ref: z.string().trim().min(1).max(200),
  }),
  z.strictObject({ action: z.literal("dismiss"), findingId: FindingId }),
  z.strictObject({ action: z.literal("restore"), findingId: FindingId }),
]);

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    const raw = new URL(request.url).searchParams.get("kitId");
    const parsed = raw === null ? null : z.guid().safeParse(raw);
    if (parsed && !parsed.success) notFound("That kit");
    const kitId = parsed?.data;
    if (kitId) await formKitContext(userId, kitId);
    return Response.json(await consistencyReport(getDb(), userId, kitId ? { kitId } : {}));
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    const userId = session.user.id;
    checkRateLimit("workspaceWrites", userId, WORKSPACE_WRITE_LIMIT);
    const body = await readJson(request, Body);
    const db = getDb();
    if (body.action === "dismiss") await dismissFinding(db, userId, body.findingId);
    else if (body.action === "restore") await restoreFinding(db, userId, body.findingId);
    else await applyExpected(userId, body);
    return Response.json({ ok: true });
  });
}
