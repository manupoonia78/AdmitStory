import "server-only";

import {
  getDb,
  getLatestProfileRead,
  listKits,
  listNeedItems,
  listStories,
  listUserSchools,
} from "@admitstory/db";
import type { SchoolPack } from "@admitstory/kb/types";
import { asPack, packRounds } from "@/lib/strategy/pack";
import { latestPack } from "@/lib/strategy/server";
import type { HomeFacts } from "./next-step";

/**
 * The applicant's round's deadline, else the next round still ahead: the same rule as the school
 * cards (lib/strategy/page-data.ts), from the published pack's verified rounds. Read-only.
 */
function nextDeadline(
  pack: SchoolPack | null,
  chosen: string | null,
  today: string,
): { round: string | null; date: string } | null {
  if (!pack) return null;
  // The date part of a deadline doesn't depend on the time zone; only its instant does.
  const rounds = packRounds(pack, "UTC");
  const next = rounds.find((r) => r.short === chosen) ?? rounds.find((r) => r.date >= today);
  return next ? { round: next.short, date: next.date } : null;
}

export async function loadHomeFacts(userId: string): Promise<HomeFacts> {
  const db = getDb();
  const [stories, read, rows, kits] = await Promise.all([
    listStories(db, userId),
    getLatestProfileRead(db, userId),
    listUserSchools(db, userId),
    listKits(db, userId),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const schools = await Promise.all(
    rows.map(async (row) => {
      const kit = kits.find((k) => k.userSchoolId === row.id) ?? null;
      const pack = await latestPack(db, row.cycle.id);
      const full = kit && kit.status !== "preview" ? kit : null;
      const needs = full ? await listNeedItems(db, userId, { kitId: full.id, status: "open" }) : [];
      return {
        userSchoolId: row.id,
        name: row.school.shortName || row.school.name,
        published: pack !== null,
        status: row.status,
        preview: kit?.status === "preview",
        deadline: nextDeadline(pack ? asPack(pack.data) : null, row.round, today),
        kit: full
          ? {
              id: full.id,
              status: full.status,
              openNeeds: needs.length,
              firstNeedDeliverable: needs[0]?.deliverableId ?? null,
            }
          : null,
      };
    }),
  );
  return {
    stories: stories.filter((s) => s.mergedInto === null).length,
    hasProfileRead: read !== null,
    schools,
  };
}
