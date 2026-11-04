import { getDb } from "@admitstory/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/app-user";
import { applicantIdentity } from "@/lib/recommenders/schools";
import { pageNow } from "@/lib/recommenders/view";
import { schoolContext } from "@/lib/school/context";
import { loadSchoolRecommenders } from "@/lib/school/recommenders";
import { RecommendersTabHost } from "./host";

export const metadata: Metadata = { title: "Recommenders" };

/** The school's Recommenders tab: each recommender's brief for this school, shaped by chat. */
export default async function SchoolRecommendersPage({
  params,
  searchParams,
}: {
  params: Promise<{ userSchoolId: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).userSchoolId);
  if (!id.success) notFound();
  const userId = session.user.id;
  const { ctx, tabs } = await schoolContext(userId, id.data);
  const pick = z.guid().safeParse((await searchParams).r);
  const [view, identity] = await Promise.all([
    loadSchoolRecommenders(userId, tabs, ctx.schoolCycleId, pick.success ? pick.data : null),
    applicantIdentity(getDb(), userId),
  ]);
  return (
    <RecommendersTabHost
      key={view.selected?.recommenderId ?? "none"}
      initial={view}
      now={pageNow()}
      timeZone={identity.timeZone ?? "UTC"}
    />
  );
}
