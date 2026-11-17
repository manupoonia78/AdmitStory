import "server-only";

import {
  getDb,
  getLatestProfileRead,
  listKits,
  listNeedItems,
  listStories,
  listUserSchools,
} from "@admitstory/db";
import { latestPack } from "@/lib/strategy/server";
import type { HomeFacts } from "./next-step";

interface Round {
  name: string;
  deadline: string | null;
}

/** The applicant's round's deadline, else the next round whose date is still ahead. Read-only. */
function nextDeadline(
  rounds: readonly Round[],
  chosen: string | null,
  today: string,
): { round: string | null; date: string } | null {
  const mine = chosen ? rounds.find((r) => r.name === chosen && r.deadline) : undefined;
  if (mine?.deadline) return { round: mine.name, date: mine.deadline.slice(0, 10) };
  const ahead = rounds
    .filter((r): r is Round & { deadline: string } => r.deadline !== null && r.deadline >= today)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  return ahead ? { round: ahead.name, date: ahead.deadline.slice(0, 10) } : null;
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
      const full = kit && kit.status !== "preview" ? kit : null;
      const needs = full ? await listNeedItems(db, userId, { kitId: full.id, status: "open" }) : [];
      return {
        userSchoolId: row.id,
        name: row.school.shortName || row.school.name,
        published: (await latestPack(db, row.cycle.id)) !== null,
        status: row.status,
        preview: kit?.status === "preview",
        deadline: nextDeadline(row.cycle.rounds, row.round, today),
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
