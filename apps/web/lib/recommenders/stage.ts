import "server-only";

import { listRecommenders } from "@admitstory/db";
import type { KitDeps, KitRef, Loaded } from "@/lib/kit/pipeline";
import { loadRecommenderContext, requestBriefs, runBriefJob } from "./briefs";

export interface BriefsStageOutput {
  /** Recommenders writing for this kit's school. */
  recommenders: number;
  /** Briefs queued or built (one per recommender per school group). */
  briefs: number;
}

/**
 * Pipeline stage 9 (plan §7): for every recommender writing for this kit's school who has stories,
 * build the first brief of each school group as part of the kit. Never fails the kit.
 *
 * The brief is built here, inside the kit's own job, rather than dispatched: the stage already has
 * the AI client and the kit's run context, and the applicant opens screen H expecting the brief to
 * be there. One recommender failing never stops the next.
 */
export async function briefsForKit(
  deps: KitDeps,
  ref: KitRef,
  loaded: Loaded,
): Promise<BriefsStageOutput> {
  const people = await listRecommenders(deps.db, ref.userId, {
    userSchoolId: loaded.ctx.userSchoolId,
  });
  let recommenders = 0;
  let briefs = 0;
  for (const person of people) {
    try {
      const ctx = await loadRecommenderContext(deps.db, ref.userId, person.id);
      if (!ctx || ctx.stories.length === 0) continue;
      const group = ctx.groups.find((g) =>
        g.schools.some((s) => s.schoolCycleId === loaded.ctx.schoolCycleId),
      );
      if (!group) continue;
      recommenders += 1;
      const summaries = await requestBriefs(deps.db, ref.userId, person.id, {
        groupKey: group.key,
        reason: "kit_stage",
      });
      const queued = summaries.filter((s) => s.status === "building").map((s) => s.groupKey);
      if (queued.length === 0) {
        briefs += summaries.filter((s) => s.status === "ready").length;
        continue;
      }
      const result = await runBriefJob(deps, {
        userId: ref.userId,
        recommenderId: person.id,
        groupKeys: queued,
        reason: "kit_stage",
      });
      briefs += result.built.length;
    } catch (error) {
      // The brief tab asks again when it is opened; the kit's essays are already written.
      console.error(`[kit] ${person.ref}'s brief was not built with the kit`, error);
    }
  }
  return { recommenders, briefs };
}
