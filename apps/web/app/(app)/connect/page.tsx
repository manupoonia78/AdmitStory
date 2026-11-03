import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon-page";
import { requireOnboardedUser } from "@/lib/app-user";
import { CONNECT_COMING_SOON as COPY } from "@/lib/deferred/coming-soon";

export const metadata: Metadata = { title: COPY.title };

// Connect is deferred with the rest of Phase 8 (docs/phase-8-experts-connect-tracker.md). It is
// not sold at launch, so this page promises nothing: it says what is coming and stops there.
export default async function Page() {
  await requireOnboardedUser();
  return <ComingSoonPage {...COPY} line={COPY.note} />;
}
