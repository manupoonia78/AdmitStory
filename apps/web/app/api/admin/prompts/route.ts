import { createPromptVersion } from "@admitstory/db";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";
import { assertPromptTemplate, promptAgents, routeOverrideFor } from "@/lib/admin/registry";
import { PromptCreateBody } from "@/lib/admin/schemas";

// POST /api/admin/prompts (spec §5.18 "Prompt registry"): a new version of an agent's prompt,
// inactive until activated. The route override names a model key only, never a model ID.
export const POST = adminRoute(async (admin, request) => {
  const body = await readJson(request, PromptCreateBody);
  if (!promptAgents().includes(body.agent))
    throw new AdminActionError(`There's no agent called ${body.agent}.`, 422);
  assertPromptTemplate(body.agent, body.version, body.template);
  const row = await createPromptVersion(admin, {
    agent: body.agent,
    version: body.version,
    template: body.template,
    routeOverride: routeOverrideFor(body.model),
  });
  return Response.json({ id: row.id, version: row.version }, { status: 201 });
});
