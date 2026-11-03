import { activatePromptVersion } from "@admitstory/db";
import { emitEvalsRun } from "@/lib/admin/dispatch";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/prompts/:promptVersionId/activate: this version takes all of its agent's
// traffic. Rollback is activating an older version. Calls pick it up within a minute (lib/ai.ts).
// Activation starts an eval run (§9.4); it is advisory here and never blocks (docs/phase-9.md).
export const POST = adminRoute<{ promptVersionId: string }>(
  async (admin, _request, { promptVersionId }) => {
    const row = await activatePromptVersion(admin, promptVersionId);
    await emitEvalsRun({
      reason: "prompt_activated",
      promptVersionId: row.id,
      slug: row.agent,
      version: Number(String(row.version).replace(/^v/, "")) || undefined,
      ...(admin.actorId ? { triggeredBy: admin.actorId } : {}),
    });
    return Response.json({ id: row.id, agent: row.agent, version: row.version });
  },
);
