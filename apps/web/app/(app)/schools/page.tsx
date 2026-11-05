import { countSchoolCredits, getDb } from "@admitstory/db";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/app-user";
import { SCHOOL_KIT_PRICE_CENTS, dollars } from "@/lib/payments/plans";
import { loadStrategy } from "@/lib/strategy/page-data";
import { SchoolCards } from "./school-cards";
import { StrategyDetails } from "./strategy-details";
import { StrategyHost } from "./strategy-host";

export const metadata: Metadata = { title: "Your schools" };

/**
 * Your schools (spec §5.5 screen E, school workspace redesign): each school as a card that opens
 * into its tabs once paid for, add schools, then the deadline horizon, the side-by-side compare,
 * the honest flags and the round planner. Every school figure shown comes
 * from the newest published pack, read on this request, with its source and verified date.
 */
export default async function SchoolsPage() {
  const { session } = await requireOnboardedUser();
  const [data, credits] = await Promise.all([
    loadStrategy(session.user.id),
    countSchoolCredits(getDb(), session.user.id),
  ]);
  return (
    <StrategyHost
      rows={data.rows}
      horizon={data.horizon}
      comparison={data.comparison}
      cards={
        <SchoolCards rows={data.rows} price={dollars(SCHOOL_KIT_PRICE_CENTS)} credits={credits} />
      }
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
