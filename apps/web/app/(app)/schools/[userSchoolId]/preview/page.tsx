import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadPreviewState } from "@/lib/strategy/preview";
import { loadSchoolPageFacts } from "@/lib/strategy/setup";
import { ApplicationSetup } from "../application-setup";
import { PreviewScreen } from "./preview-screen";
import { ShowcaseDetails, ShowcaseIntro } from "./showcase";

export const metadata: Metadata = { title: "Free preview" };

/**
 * The free preview for one school (spec §5.5; reshaped by Manu, 4 Nov 2026): the round and
 * reapplicant choices, what the school looks for, a worked example of a story reshaped for it, the
 * applicant's own positioning once they've told us a story, what the pack drafts and pointers from
 * our research, then "Unlock {School}". Only the applicant's own schools; any other id is a 404.
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ userSchoolId: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).userSchoolId);
  if (!id.success) notFound();
  const [preview, facts] = await Promise.all([
    loadPreviewState(session.user.id, id.data),
    loadSchoolPageFacts(session.user.id, id.data),
  ]);
  if (!preview || !facts) notFound();
  return (
    <PreviewScreen
      userSchoolId={id.data}
      initial={preview}
      hasStories={facts.storyCount > 0}
      setup={facts.showcase ? <ApplicationSetup setup={facts.setup} /> : null}
      intro={facts.showcase ? <ShowcaseIntro view={facts.showcase} /> : null}
      details={facts.showcase ? <ShowcaseDetails view={facts.showcase} /> : null}
    />
  );
}
