import { getDb } from "@admitstory/db";
import { EmptyState, RECOMMENDERS_COPY } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Page as PageFrame } from "@/components/page-header";
import { requireOnboardedUser } from "@/lib/app-user";
import { applicantIdentity } from "@/lib/recommenders/schools";
import { loadRecommendersPage } from "@/lib/recommenders/view";
import { RecommendersHost } from "./recommenders-host";

export const metadata: Metadata = { title: "Recommenders" };

/**
 * Screen H (spec §5.11, §6.10 H): the people who write for the applicant, each with a brief of
 * their own. This page is the list and the way in; one recommender's stories, brief, coverage and
 * status live at /recommenders/[recommenderId].
 *
 * Nothing on the applicant's side ever shows what a recommender wrote, or their private link
 * (§14.3, plan decision 7).
 */
export default async function Page() {
  const { session } = await requireOnboardedUser();
  const userId = session.user.id;
  const [view, identity] = await Promise.all([
    loadRecommendersPage(userId),
    applicantIdentity(getDb(), userId),
  ]);

  if (view.state === "locked")
    return (
      <PageFrame title={RECOMMENDERS_COPY.title}>
        <EmptyState
          title={RECOMMENDERS_COPY.lockedTitle}
          description={RECOMMENDERS_COPY.lockedBody}
          action={
            <Link href="/schools" className="text-signal underline">
              {RECOMMENDERS_COPY.lockedAction}
            </Link>
          }
        />
      </PageFrame>
    );

  return (
    <PageFrame title={RECOMMENDERS_COPY.title}>
      <p className="max-w-[48ch] font-reading text-reading-lg text-balance text-text">
        {RECOMMENDERS_COPY.lead}
      </p>
      <RecommendersHost view={view} timeZone={identity.timeZone ?? "UTC"} />
    </PageFrame>
  );
}
