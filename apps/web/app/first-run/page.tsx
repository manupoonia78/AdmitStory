import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/app-user";
import { FirstRunFlow } from "./first-run-flow";

export const metadata: Metadata = {
  title: "Getting started",
  robots: { index: false, follow: false },
};

/** First run (spec §5.1): four screens, then straight into Story Studio. */
export default async function FirstRunPage() {
  const { profile } = await requireOnboardedUser();
  if (profile.firstRunCompletedAt) redirect("/studio");

  return (
    <FirstRunFlow
      defaults={{
        programType: profile.programType,
        targetIntake: profile.targetIntake,
        country: profile.country,
        timezone: profile.timezone,
      }}
    />
  );
}
