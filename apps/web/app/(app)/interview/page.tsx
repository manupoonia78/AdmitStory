import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon-page";
import { requireOnboardedUser } from "@/lib/app-user";
import { INTERVIEW_COMING_SOON as COPY } from "@/lib/interview/coming-soon";

export const metadata: Metadata = { title: COPY.title };

// Interview Studio is deferred (docs/phase-7-interview-studio.md), with a promise: kit owners get
// it at no extra cost when it opens, which is why the line below is COPY.promise.
export default async function Page() {
  await requireOnboardedUser();
  return <ComingSoonPage {...COPY} line={COPY.promise} />;
}
