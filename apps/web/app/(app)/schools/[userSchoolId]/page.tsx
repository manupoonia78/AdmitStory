import { DEFAULT_IDENTITY } from "@admitstory/shared";
import { getDb, getKitContext, getKitForUserSchool, getUserSchool } from "@admitstory/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadKitView } from "@/lib/kit/view";
import { loadSchoolPrep } from "@/lib/school/prep";
import { KitHost } from "../../kits/[id]/kit-host";

export const metadata: Metadata = { title: "Your school" };

/** Which deliverable a ready school opens on: the first essay, else the first thing drafted. */
const OPEN_FIRST = ["essay", "short_answer", "goal_field", "video", "form_section"];

/**
 * One school, from the inside (school workspace redesign). Not paid for yet: the unlock page.
 * Paid and still being prepared: the three steps (stories, the school's questions, the drafts
 * assembling). Ready: straight into the school's tabs, on its first essay.
 */
export default async function SchoolPage({
  params,
}: {
  params: Promise<{ userSchoolId: string }>;
}) {
  const { session, profile } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).userSchoolId);
  if (!id.success) notFound();
  const userId = session.user.id;
  const db = getDb();
  const row = await getUserSchool(db, userId, id.data);
  if (!row) notFound();
  const kit = await getKitForUserSchool(db, userId, row.id);
  if (!kit || kit.status === "preview") redirect(`/schools/${row.id}/unlock`);
  const view = await loadKitView(userId, kit.id);
  if (!view) notFound();
  if (view.status === "ready") {
    const first = OPEN_FIRST.map((type) =>
      view.deliverables.find((d) => d.type === type && d.status !== "pending"),
    ).find(Boolean);
    if (first) redirect(`/workspace/${first.id}`);
  }
  const ctx = await getKitContext(db, userId, kit.id);
  const prep = await loadSchoolPrep(userId, row.id, kit.createdAt, ctx?.cycle ?? "");
  return <KitHost initial={view} identity={profile.voiceprint ?? DEFAULT_IDENTITY} prep={prep} />;
}
