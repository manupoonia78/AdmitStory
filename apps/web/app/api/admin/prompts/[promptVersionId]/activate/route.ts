import { activatePromptVersion } from "@admitstory/db";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/prompts/:promptVersionId/activate: this version takes all of its agent's
// traffic. Rollback is activating an older version. Calls pick it up within a minute (lib/ai.ts).
export const POST = adminRoute<{ promptVersionId: string }>(
  async (admin, _request, { promptVersionId }) => {
    const row = await activatePromptVersion(admin, promptVersionId);
    return Response.json({ id: row.id, agent: row.agent, version: row.version });
  },
);
