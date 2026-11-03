import { EFFORTS, ROUTABLE_MODEL_KEYS, ROUTES, RouteOverride } from "@admitstory/ai";
import { clearRouteOverride, setRouteOverride } from "@admitstory/db";
import { AdminReason } from "@admitstory/shared/schemas";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";

// PUT / DELETE /api/admin/routing/:task (spec §8.3 "routing is data"): override one task's model
// key, effort or token budget, with a reason, or clear the override. Model keys only, never model
// IDs (§0). Calls pick it up within a minute (the registry overlay's cache).

const Body = z.strictObject({
  model: z.enum(ROUTABLE_MODEL_KEYS),
  effort: z.enum(EFFORTS).nullable().optional(),
  maxTokens: z.int().min(256).max(64_000).nullable().optional(),
  reason: z.string().trim().min(3).max(300),
});

function assertTask(task: string): void {
  if (!Object.hasOwn(ROUTES, task))
    throw new AdminActionError("There's no task with that name.", 404);
}

export const PUT = adminRoute<{ task: string }>(async (admin, request, { task }) => {
  assertTask(task);
  const body = await readJson(request, Body);
  const override = RouteOverride.parse({
    model: body.model,
    ...(body.effort ? { effort: body.effort } : {}),
    ...(body.maxTokens ? { maxTokens: body.maxTokens } : {}),
  }) as Record<string, unknown>;
  const row = await setRouteOverride(admin, task, { override, reason: body.reason });
  return Response.json({ task: row.task, override: row.override });
});

export const DELETE = adminRoute<{ task: string }>(async (admin, request, { task }) => {
  assertTask(task);
  const { reason } = await readJson(request, AdminReason);
  const cleared = await clearRouteOverride(admin, task, reason);
  return Response.json({ cleared });
});
