// The publish gate (spec §9.3 "Publish pack version N+1"; §0 "never invent school facts"). A pack
// version can be published only when it validates, is marked complete, has nothing left to fill,
// and every item in it has been verified. Stale items (verified in an earlier cycle) don't block:
// the compiler keeps stale specifics out and marks the rest, and the admin sees them greyed.
// Unresolved field conflicts (proposals.ts) never reach the pack, so they can't block it here; they
// block only their own field.

import { SchoolPack as SchoolPackSchema } from "./schema/school-pack";
import { citedNodes } from "./walk";

export interface PublishBlocker {
  path: string;
  reason: "invalid" | "draft" | "todo" | "unverified";
  detail: string;
}

export function publishBlockers(pack: unknown): PublishBlocker[] {
  const parsed = SchoolPackSchema.safeParse(pack);
  if (!parsed.success)
    return parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "pack",
      reason: "invalid" as const,
      detail: issue.message,
    }));
  const valid = parsed.data;
  const blockers: PublishBlocker[] = [];
  if (valid.status !== "complete")
    blockers.push({ path: "status", reason: "draft", detail: "The pack is still a draft" });
  for (const todo of valid._todo ?? [])
    blockers.push({ path: "_todo", reason: "todo", detail: todo });
  for (const node of citedNodes(valid))
    if (node.verifiedAt === null)
      blockers.push({
        path: node.path,
        reason: "unverified",
        detail: `${node.id} hasn't been verified`,
      });
  return blockers;
}
