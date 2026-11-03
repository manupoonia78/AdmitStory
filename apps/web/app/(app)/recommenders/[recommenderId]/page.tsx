import { getDb } from "@admitstory/db";
import { COMMON_GROUP_KEY } from "@admitstory/shared/kit";
import { tabFromParam } from "@admitstory/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/app-user";
import { applicantIdentity } from "@/lib/recommenders/schools";
import {
  loadBriefView,
  loadRecommenderDetail,
  loadRecommendersPage,
  pageNow,
} from "@/lib/recommenders/view";
import { loadStatusView } from "@/lib/reminders/view";
import { DetailHost } from "./detail-host";

export const metadata: Metadata = { title: "Recommender" };

/**
 * One recommender (spec §5.11, §6.10 H): their stories, their brief, how the briefs divide the
 * applicant's work between recommenders, and where the invitation stands.
 *
 * The tab is in the URL, so each one is a fresh read of only what it shows — and the status tab's
 * reminders are synced against the deadlines as they are read.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ recommenderId: string }>;
  searchParams: Promise<{ tab?: string; group?: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const userId = session.user.id;
  const parsed = z.guid().safeParse((await params).recommenderId);
  if (!parsed.success) notFound();
  const id = parsed.data;
  const query = await searchParams;
  const tab = tabFromParam(query.tab);

  const [detail, list, identity] = await Promise.all([
    loadRecommenderDetail(userId, id),
    loadRecommendersPage(userId),
    applicantIdentity(getDb(), userId),
  ]);
  if (!detail) notFound();

  const groupKey = detail.briefs.some((brief) => brief.groupKey === query.group)
    ? (query.group as string)
    : (detail.briefs[0]?.groupKey ?? COMMON_GROUP_KEY);
  const [brief, status] = await Promise.all([
    tab === "brief" ? loadBriefView(userId, id, groupKey) : null,
    tab === "status" ? loadStatusView(userId, id) : null,
  ]);

  return (
    <DetailHost
      detail={detail}
      list={list}
      tab={tab}
      brief={brief}
      groupKey={groupKey}
      status={status}
      timeZone={identity.timeZone ?? "UTC"}
      now={pageNow()}
    />
  );
}
