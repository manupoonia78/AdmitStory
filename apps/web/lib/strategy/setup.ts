import "server-only";

import { getCycleWithSchool, getDb, getUserSchool, listStories } from "@admitstory/db";
import { roundCode } from "@admitstory/ui";
import { asPack, packRounds, shortDate } from "./pack";
import { latestPack } from "./server";
import { showcaseView, type ShowcaseView } from "./showcase";

// One school's page-level facts for the preview and unlock pages (Manu, 4 Nov 2026): the
// application strip (round, applied before, what happened) that used to sit at the bottom of the
// schools list, and the showcase of what the school's pack holds. Null when the school isn't on
// the caller's list.

export interface SetupRound {
  /** What PATCH /api/user-schools/:id takes as `round`: the round's short name. */
  value: string;
  /** "Round 1 · 9 Sep", or "D4 · 15 Nov" for a school with many numbered deadlines. */
  label: string;
  past: boolean;
}

export interface SchoolSetup {
  userSchoolId: string;
  schoolName: string;
  rounds: SetupRound[];
  round: string | null;
  isReapplicant: boolean;
  previousOutcome: string | null;
  /** A school with a paid kit can't be taken off the list. */
  removable: boolean;
}

export interface SchoolPageFacts {
  setup: SchoolSetup;
  showcase: ShowcaseView | null;
  storyCount: number;
}

/** "9 Sep" from "2026-09-09". */
function dayMonth(isoDate: string): string {
  return shortDate(isoDate).replace(/\s\d{4}$/, "");
}

export async function loadSchoolPageFacts(
  userId: string,
  userSchoolId: string,
  now = new Date(),
): Promise<SchoolPageFacts | null> {
  const db = getDb();
  const row = await getUserSchool(db, userId, userSchoolId);
  if (!row) return null;
  const [cycle, published, stories] = await Promise.all([
    getCycleWithSchool(db, row.schoolCycleId),
    latestPack(db, row.schoolCycleId),
    listStories(db, userId),
  ]);
  const schoolName = cycle?.school.shortName || cycle?.school.name || "This school";
  const pack = published ? asPack(published.data) : null;
  const today = now.toISOString().slice(0, 10);
  const rounds = pack
    ? packRounds(pack, "UTC").map((r) => ({
        value: r.short,
        label: `${r.label.length <= 14 ? r.label : roundCode(r.short, r.label)} · ${dayMonth(r.date)}`,
        past: r.date < today,
      }))
    : [];
  return {
    setup: {
      userSchoolId: row.id,
      schoolName,
      rounds,
      round: row.round,
      isReapplicant: row.isReapplicant,
      previousOutcome: row.previousOutcome,
      removable: row.status === "considering" || row.status === "preview",
    },
    showcase: pack
      ? showcaseView({
          slug: cycle?.school.slug ?? null,
          schoolName,
          pack,
          isReapplicant: row.isReapplicant,
        })
      : null,
    storyCount: stories.filter((story) => story.mergedInto === null).length,
  };
}
