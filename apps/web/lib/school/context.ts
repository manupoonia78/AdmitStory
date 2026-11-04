import "server-only";

import {
  getDb,
  getKitContext,
  getKitForUserSchool,
  getUserSchool,
  type KitContext,
} from "@admitstory/db";
import { notFound, redirect } from "next/navigation";
import { requireKitAccess } from "@/lib/workspace/server";
import { kitFiles } from "@/lib/workspace/view";
import { schoolTabs, type SchoolTabsView } from "./tabs";

// For the school's own pages (Recommenders, Résumé): the paid kit behind the school and its tabs.
// Not paid yet goes to unlock; still being prepared goes to the school page and its steps.

export async function schoolContext(
  userId: string,
  userSchoolId: string,
): Promise<{ ctx: KitContext; tabs: SchoolTabsView }> {
  const db = getDb();
  const row = await getUserSchool(db, userId, userSchoolId);
  if (!row) notFound();
  const kit = await getKitForUserSchool(db, userId, row.id);
  if (!kit || kit.status === "preview") redirect(`/schools/${row.id}/unlock`);
  if (kit.status !== "ready") redirect(`/schools/${row.id}`);
  const ctx = await getKitContext(db, userId, kit.id);
  if (!ctx) notFound();
  await requireKitAccess(userId, ctx);
  const files = await kitFiles(userId, kit.id, { schoolCycleId: ctx.schoolCycleId });
  return {
    ctx,
    tabs: schoolTabs(
      { userSchoolId: row.id, school: ctx.school.shortName || ctx.school.name, cycle: ctx.cycle },
      files,
    ),
  };
}
