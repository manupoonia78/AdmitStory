import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadResumeView } from "@/lib/forms/resume-view";
import { ResumeHost } from "./resume-host";

export const metadata: Metadata = { title: "Your resume" };

/**
 * The Résumé Pass (spec §5.10): the applicant's résumé as a page with its limit, each bullet's
 * feedback and rewrite to keep or not, the suggested section order and the Word export. One per
 * applicant, shared by every kit; it comes with the first School Kit.
 */
export default async function ResumePage() {
  const { session } = await requireOnboardedUser();
  return <ResumeHost initial={await loadResumeView(session.user.id)} />;
}
