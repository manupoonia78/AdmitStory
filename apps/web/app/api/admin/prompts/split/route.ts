import { setPromptAbSplit } from "@admitstory/db";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";
import { PromptSplitBody } from "@/lib/admin/schemas";

// POST /api/admin/prompts/split (spec §5.18 "A/B split"): weights across up to five versions of
// one agent, summing to 100. Each user stays in one bucket while the weights hold.
export const POST = adminRoute(async (admin, request) => {
  const { agent, split } = await readJson(request, PromptSplitBody);
  const total = split.reduce((sum, entry) => sum + entry.weight, 0);
  if (total !== 100) throw new AdminActionError(`The weights add up to ${total}, not 100.`, 422);
  const rows = await setPromptAbSplit(admin, agent, split);
  return Response.json({ versions: rows.map((r) => ({ id: r.id, weight: r.abWeight })) });
});
