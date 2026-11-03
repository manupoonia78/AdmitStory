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

export async function loadHomeFacts(userId: string): Promise<HomeFacts> {
  const db = getDb();
  const [stories, read, rows, kits] = await Promise.all([
    listStories(db, userId),
    getLatestProfileRead(db, userId),
    listUserSchools(db, userId),
    listKits(db, userId),
  ]);
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
