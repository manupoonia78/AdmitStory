// What it won't do (direction §4.7): the section a sceptical applicant reads twice. A Night plane
// in either theme, five lines in Newsreader numbered in the margin, then each school's AI policy as
// we verified it. Until Manu verifies a policy there is no table, only the fallback sentence.
// No icons, no motion.

import { verifiedPolicies } from "@/lib/marketing/public-data";
import { WONT_DO_COPY } from "../_copy/landing";
import { AI_POLICY_FALLBACK, INTEGRITY_LINES } from "../_copy/shared";
import { AiPolicyTable } from "../_ui/ai-policy-table";
import { TEXT_LINK } from "../_ui/cta-link";
import { DisplayHeading } from "../_ui/display-heading";
import { Section } from "../_ui/section";
import Link from "next/link";

export async function WontDoSection() {
  const policies = await verifiedPolicies();
  return (
    <Section id="wont-do" labelledBy="wont-do-title" theme="night">
      <div className="col-span-4 sm:col-span-8 lg:col-span-10">
        <DisplayHeading level={2} size="lg" id="wont-do-title" lines={[WONT_DO_COPY.heading]} />
      </div>
      <ol
        role="list"
        className="col-span-4 mt-12 divide-y divide-edge border-y border-edge sm:col-span-8 lg:col-span-11 lg:mt-20"
      >
        {INTEGRITY_LINES.map((line, index) => (
          <li
            key={line}
            className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-8 sm:grid-cols-[4rem_1fr] lg:py-10"
          >
            <span aria-hidden="true" className="pt-3 text-sm text-text-soft tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="max-w-[46rem] font-reading text-display-sm font-normal tracking-[-0.01em] text-text [line-height:1.2]">
              {line}
            </p>
          </li>
        ))}
      </ol>
      <div className="col-span-4 mt-12 sm:col-span-8 lg:col-span-9 lg:col-start-1 lg:mt-16">
        {policies.length === 0 ? (
          <p className="text-base text-text-soft">{AI_POLICY_FALLBACK}</p>
        ) : (
          <>
            <p className="text-base text-text-soft">{WONT_DO_COPY.policyLine}</p>
            <AiPolicyTable rows={policies} limit={6} variant="compact" className="mt-6" />
            <Link href="/how-it-works#ai-policies" className={`${TEXT_LINK} mt-4`}>
              {WONT_DO_COPY.allPolicies}
            </Link>
          </>
        )}
      </div>
    </Section>
  );
}
