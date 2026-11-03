import { DEFAULT_IDENTITY } from "@admitstory/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadKitView } from "@/lib/kit/view";
import { KitHost } from "./kit-host";

export const metadata: Metadata = { title: "Your kit" };

/**
 * Kit generation (spec §5.7, screen F): the assembly hero, the stage list with "Read it now", and
 * the gap questions plane. The server renders the kit as it stands, so a reload mid-run lands in
 * the same place; progress then streams from GET /api/kits/:id/events.
 */
export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, profile } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).id);
  if (!id.success) notFound();
  const view = await loadKitView(session.user.id, id.data);
  if (!view || view.status === "preview") notFound();
  return <KitHost initial={view} identity={profile.voiceprint ?? DEFAULT_IDENTITY} />;
}
