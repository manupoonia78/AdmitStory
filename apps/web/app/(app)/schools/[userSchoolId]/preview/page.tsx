import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadPreviewState } from "@/lib/strategy/preview";
import { PreviewScreen } from "./preview-screen";

export const metadata: Metadata = { title: "Kit preview" };

/**
 * The free kit preview for one school (spec §5.5): the positioning headline, the file map (titles
 * only) and the deliverables, present but locked, with "Unlock {School} for $100". Only the
 * applicant's own schools; any other id is a 404.
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ userSchoolId: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).userSchoolId);
  if (!id.success) notFound();
  const preview = await loadPreviewState(session.user.id, id.data);
  if (!preview) notFound();
  return <PreviewScreen userSchoolId={id.data} initial={preview} />;
}
