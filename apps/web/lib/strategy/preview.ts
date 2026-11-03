import "server-only";

import { BudgetExceededError, checkBudget, type BudgetDecision } from "@admitstory/ai";
import {
  createUsageLedgerSink,
  getCycleWithSchool,
  getDb,
  getKitForUserSchool,
  getLatestSnapshot,
  getUserSchool,
} from "@admitstory/db";
import type { FileMap, Positioning } from "@admitstory/shared/kit";
import { packDeliverables } from "./deliverables";
import { asPack, type RetrievalSource } from "./pack";
import { previewCurrent, previewDecision } from "./preview-policy";
import { previewView } from "./preview-view";
import { latestPack } from "./server";
import { storyTitles } from "./jobs";
import { readStoredFit } from "./stored-fit";
import type { PreviewState } from "./types";

// The kit preview's state for the page (spec §5.5): what GET /api/user-schools/:id/preview returns
// and what the Strategy page renders first. Null when the school isn't on the caller's list.

export interface PreviewContext {
  schoolId: string | null;
  schoolName: string;
  state: PreviewState;
}

export async function loadPreviewState(
  userId: string,
  userSchoolId: string,
  now = new Date(),
): Promise<PreviewContext | null> {
  const db = getDb();
  const row = await getUserSchool(db, userId, userSchoolId);
  if (!row) return null;
  const [published, kit, snapshot, cycle] = await Promise.all([
    latestPack(db, row.schoolCycleId),
    getKitForUserSchool(db, userId, userSchoolId),
    getLatestSnapshot(db, userId),
    getCycleWithSchool(db, row.schoolCycleId),
  ]);
  const schoolName = cycle?.school.shortName ?? cycle?.school.name ?? "This school";
  const schoolId = cycle?.school.id ?? null;
  if (!published) return { schoolId, schoolName, state: { state: "coming_soon" } };

  const job = readStoredFit(row.fit).previewJob;
  const facts = {
    published: true,
    packVersion: published.version,
    snapshotVersion: snapshot?.version ?? null,
    kit,
    job,
    now,
  };
  const decision = previewDecision(facts);

  // A preview on screen is never taken away: an older one shows, marked stale, while a new one runs.
  if (kit?.positioning && kit.fileMap) {
    const pack = asPack(published.data);
    const fileMap = kit.fileMap as unknown as FileMap & { retrieval?: RetrievalSource[] };
    const view = previewView({
      schoolName,
      pack,
      positioning: kit.positioning as unknown as Positioning,
      fileMap: { ...fileMap, items: Array.isArray(fileMap.items) ? fileMap.items : [] },
      deliverables: packDeliverables(pack, row.isReapplicant),
      stories: await storyTitles(userId),
      retrieval: Array.isArray(fileMap.retrieval) ? fileMap.retrieval : [],
      builtAt: kit.updatedAt ?? kit.createdAt,
    });
    return {
      schoolId,
      schoolName,
      state: {
        state: "ready",
        preview: view,
        stale: !previewCurrent(facts),
        updating: decision === "running",
      },
    };
  }
  if (decision === "running" && job)
    return { schoolId, schoolName, state: { state: "running", since: job.at } };
  if (job?.state === "failed")
    return { schoolId, schoolName, state: { state: "failed", at: job.at } };
  if (job?.state === "budget") return { schoolId, schoolName, state: { state: "budget" } };
  return { schoolId, schoolName, state: { state: "idle" } };
}

/** Whether the free allowance still covers a preview, checked before anything is queued. */
export async function previewBudget(userId: string): Promise<BudgetDecision | "exceeded"> {
  try {
    return await checkBudget({
      ledger: createUsageLedgerSink(getDb()),
      userId,
      // kit.positioning_filemap has no cheaper route: past the cap it is refused, not downgraded.
      route: {},
    });
  } catch (error) {
    if (error instanceof BudgetExceededError) return "exceeded";
    throw error;
  }
}
