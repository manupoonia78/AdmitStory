import {
  countSchoolCredits,
  getCycleWithSchool,
  getDb,
  getKitForUserSchool,
  getUserSchool,
} from "@admitstory/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { capturePageEvent } from "@/lib/analytics/server";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadPreviewState } from "@/lib/strategy/preview";
import { latestPack } from "@/lib/strategy/server";
import { loadSchoolPageFacts } from "@/lib/strategy/setup";
import { ApplicationSetup } from "../application-setup";
import { UnlockScreen } from "./unlock-screen";

export const metadata: Metadata = { title: "Unlock School Kit" };

/**
 * Unlock a school (spec §5.6): $100 for the full kit for one school and cycle, or a 5- or 10-school
 * pack that starts here (Manu, 5 Nov 2026); with pack credits left, one is spent instead of paying.
 * The provider's checkout opens over this page; the webhook, never this page, grants the kit. After
 * paying, the page waits for the kit to exist and then moves to it.
 */
export default async function UnlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ userSchoolId: string }>;
  /** `paid=1` is ours on the return URL; Dodo appends `payment_id` and `status`. */
  searchParams: Promise<{ paid?: string; status?: string }>;
}) {
  const { session } = await requireOnboardedUser();
  const id = z.guid().safeParse((await params).userSchoolId);
  if (!id.success) notFound();
  const db = getDb();
  const row = await getUserSchool(db, session.user.id, id.data);
  if (!row) notFound();
  const [kit, cycle, published, facts, credits, preview] = await Promise.all([
    getKitForUserSchool(db, session.user.id, row.id),
    getCycleWithSchool(db, row.schoolCycleId),
    latestPack(db, row.schoolCycleId),
    loadSchoolPageFacts(session.user.id, row.id),
    countSchoolCredits(db, session.user.id),
    loadPreviewState(session.user.id, row.id),
  ]);
  if (kit && kit.status !== "preview") redirect(`/schools/${row.id}`);
  const school = cycle?.school.shortName || cycle?.school.name || "this school";
  const query = await searchParams;
  const declined = query.status === "failed" || query.status === "cancelled";
  // The opening of their own essay, when the free preview drafted one: shown again where they pay.
  const opening =
    preview?.state.state === "ready" && preview.state.preview.opening
      ? { essay: preview.state.preview.opening.essay, text: preview.state.preview.opening.text }
      : null;
  if (query.paid !== "1")
    capturePageEvent({
      distinctId: session.user.id,
      event: "unlock_viewed",
      properties: {
        has_preview: kit !== null,
        has_opening: opening !== null,
        credits,
        declined,
      },
    });
  return (
    <UnlockScreen
      userSchoolId={row.id}
      school={school}
      cycle={cycle?.cycle.cycle ?? ""}
      credits={credits}
      available={published !== null}
      paid={query.paid === "1" && !declined}
      declined={declined}
      email={session.user.email}
      opening={opening}
      setup={published && facts ? <ApplicationSetup setup={facts.setup} /> : null}
    />
  );
}
