import "server-only";

import { getDb, listKits, listUserSchools } from "@admitstory/db";
import { latestPack } from "@/lib/strategy/server";

// The school the applicant would unlock next (16 Nov 2026): the first on their list that can be
// bought and isn't yet. The Studio's halfway prompt, the end-of-session card and the Profile Read
// all point at it, so every free step ends one click from that school's preview or unlock page
// rather than back at a list.

export interface NextSchool {
  userSchoolId: string;
  /** The short name where there is one: "Halvorsen". */
  name: string;
  /** Its free preview has been built. */
  preview: boolean;
}

export async function nextSchoolToUnlock(userId: string): Promise<NextSchool | null> {
  const db = getDb();
  const [rows, kits] = await Promise.all([listUserSchools(db, userId), listKits(db, userId)]);
  const open: NextSchool[] = [];
  for (const row of rows) {
    const kit = kits.find((k) => k.userSchoolId === row.id) ?? null;
    // Already unlocked: a kit that is more than a preview.
    if (kit && kit.status !== "preview") continue;
    if ((await latestPack(db, row.cycle.id)) === null) continue;
    open.push({
      userSchoolId: row.id,
      name: row.school.shortName || row.school.name,
      preview: kit !== null,
    });
  }
  // One they have already previewed is the one they are closest to.
  return open.find((school) => school.preview) ?? open[0] ?? null;
}
