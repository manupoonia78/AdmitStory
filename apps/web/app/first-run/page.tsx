import { getDb, listSeedSchools } from "@admitstory/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { requireOnboardedUser } from "@/lib/app-user";
import { FirstRunFlow } from "./first-run-flow";

export const metadata: Metadata = {
  title: "Getting started",
  robots: { index: false, follow: false },
};

/**
 * First run (spec §5.1): five short screens, then straight into Story Studio. The second asks
 * which schools they are aiming for (16 Nov 2026), from the ones with a published pack, so the
 * free steps that follow can each point at a real school's preview.
 */
export default async function FirstRunPage() {
  const { profile } = await requireOnboardedUser();
  if (profile.firstRunCompletedAt) redirect("/studio");
  const schools = (await listSeedSchools(getDb()))
    .flatMap((school) =>
      school.publishedPack && school.cycle
        ? [{ cycleId: school.cycle.id, name: school.shortName || school.name }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AuthShell width="wide" footnote={null}>
      <FirstRunFlow
        schools={schools}
        defaults={{
          programType: profile.programType,
          targetIntake: profile.targetIntake,
          country: profile.country,
          timezone: profile.timezone,
        }}
      />
    </AuthShell>
  );
}
