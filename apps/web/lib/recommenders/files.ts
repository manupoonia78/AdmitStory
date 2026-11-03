import "server-only";

import { listLorBriefs, type DbExecutor } from "@admitstory/db";

/**
 * The Files pane's "Recommender briefs" entry status for one kit's school: "draft_ready" when a
 * ready brief covers the school, else "waiting".
 */
export async function recommenderFileStatus(
  db: DbExecutor,
  userId: string,
  schoolCycleId: string,
): Promise<"draft_ready" | "waiting"> {
  const briefs = await listLorBriefs(db, userId);
  return briefs.some((b) => b.status === "ready" && b.schoolCycleIds.includes(schoolCycleId))
    ? "draft_ready"
    : "waiting";
}
