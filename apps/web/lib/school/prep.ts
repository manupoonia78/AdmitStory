import "server-only";

import { getDb, getGoals, getUserSchool, listStories } from "@admitstory/db";
import type { SchoolPrep } from "./prep-types";

export type { SchoolPrep };

// What the school page shows before the drafts are ready (school workspace redesign): whether
// the applicant has told enough of their story for good drafts, and what the school offers for
// their goal, so the "why this school" answers can name it.

interface StoredFit {
  looks_for?: { school_value: string; note: string }[];
  outcome_in_target_function?: { text: string } | null;
}

export async function loadSchoolPrep(
  userId: string,
  userSchoolId: string,
  kitStartedAt: Date,
  cycle: string,
): Promise<SchoolPrep> {
  const db = getDb();
  const [row, stories, goals] = await Promise.all([
    getUserSchool(db, userId, userSchoolId),
    listStories(db, userId),
    getGoals(db, userId),
  ]);
  const live = stories.filter((s) => s.mergedInto === null);
  const fit = (row?.fit ?? null) as StoredFit | null;
  return {
    userSchoolId,
    cycle,
    stories: live.length,
    goalsSet: Boolean(goals?.shortTerm?.trim() || goals?.longTerm?.trim()),
    storiesSinceKit: live.filter((s) => s.createdAt > kitStartedAt).length,
    offers: (fit?.looks_for ?? [])
      .slice(0, 5)
      .map((l) => ({ value: l.school_value, note: l.note })),
    outcome: fit?.outcome_in_target_function?.text ?? null,
  };
}
