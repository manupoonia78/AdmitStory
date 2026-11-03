import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon-page";
import { requireOnboardedUser } from "@/lib/app-user";
import { TRACKER_COMING_SOON as COPY } from "@/lib/deferred/coming-soon";

export const metadata: Metadata = { title: COPY.title };

// The Tracker is deferred with the rest of Phase 8 (docs/phase-8-experts-connect-tracker.md).
// Deadlines stay on School Strategy until it opens, which is what the note says.
export default async function Page() {
  await requireOnboardedUser();
  return <ComingSoonPage {...COPY} line={COPY.note} />;
}
