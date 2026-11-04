import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadResumeWork } from "@/lib/resume/view";
import { ResumeWorkHost } from "./resume-work-host";

export const metadata: Metadata = { title: "Your résumé" };

/**
 * The Résumé (school workspace redesign): the narrative it tells, built from the applicant's
 * stories, a pasted CV or their upload, then shaped by chat. One per applicant, shared by every
 * school; each school's Résumé tab opens the same document. The line-by-line review of an
 * uploaded résumé is at /resume/review.
 */
export default async function ResumePage() {
  const { session } = await requireOnboardedUser();
  return <ResumeWorkHost initial={await loadResumeWork(session.user.id)} />;
}
