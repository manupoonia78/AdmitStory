import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/app-user";
import { loadStrategy } from "@/lib/strategy/page-data";
import { StrategyDetails } from "./strategy-details";
import { StrategyHost } from "./strategy-host";

export const metadata: Metadata = { title: "School Strategy" };

/**
 * School Strategy (spec §5.5, screen E): add schools, see them on the deadline horizon, compare two
 * or more side by side, read the honest flags and plan the rounds. Every school figure shown comes
 * from the newest published pack, read on this request, with its source and verified date.
 */
export default async function SchoolsPage() {
  const { session } = await requireOnboardedUser();
  const data = await loadStrategy(session.user.id);
  return (
    <StrategyHost
      rows={data.rows}
      horizon={data.horizon}
      comparison={data.comparison}
      details={
        <StrategyDetails
          flags={data.flags}
          planner={data.planner}
          hasPublished={data.rows.some((r) => r.pack === "published")}
          now={data.now}
          timeZone={data.applicant.timeZone}
        />
      }
      now={data.now}
      timeZone={data.applicant.timeZone}
    />
  );
}
