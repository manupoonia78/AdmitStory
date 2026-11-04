import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SchoolHeader } from "@/components/school-header";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadResumeWork } from "@/lib/resume/view";
import { schoolContext } from "@/lib/school/context";
import { ResumeWorkHost } from "../../../resume/resume-work-host";

export const metadata: Metadata = { title: "Résumé" };

/** The school's Résumé tab: the applicant's one résumé, inside the school's tabs. */
export default async function SchoolResumePage({
  params,
}: {
  params: Promise<{ userSchoolId: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).userSchoolId);
  if (!id.success) notFound();
  const userId = session.user.id;
  const [{ tabs }, view] = await Promise.all([
    schoolContext(userId, id.data),
    loadResumeWork(userId),
  ]);
  return <ResumeWorkHost initial={view} header={<SchoolHeader view={tabs} active="resume" />} />;
}
