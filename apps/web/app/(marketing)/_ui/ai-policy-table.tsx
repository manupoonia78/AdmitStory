// Each school's AI policy as we verified it (direction §4.7 and §6, plan §3.3). Server component.
// It renders nothing without rows: until Manu verifies the policies, pages show
// AI_POLICY_FALLBACK instead (the caller decides where). Stance and mode are in words, never colour.
//
// compact  school, stance, verified date (the landing page, limited to six rows)
// full     adds what AdmitStory does for that stance and a link to the school's own page
//          (/how-it-works#ai-policies)

import { cx } from "@admitstory/ui";
import type { PublicAiPolicy } from "@/lib/marketing/public-data";

type Stance = PublicAiPolicy["stance"];

export const STANCE_WORDS: Record<Stance, string> = {
  permitted: "Allows AI help",
  permitted_with_disclosure: "Allows AI help if you disclose it",
  limited: "Limits AI help",
  prohibited: "Doesn't allow AI-written answers",
  unknown: "No published policy",
};

/**
 * What AdmitStory does for each stance, as apps/web/lib/kit/authorship.ts decides it for written
 * deliverables: limited and prohibited coach; everything else drafts from your own words, with the
 * disclosure helper where a school asks for disclosure.
 */
export const STANCE_MODE: Record<Stance, string> = {
  permitted: "Draft mode",
  permitted_with_disclosure: "Draft mode with the disclosure helper",
  limited: "Coach mode",
  prohibited: "Coach mode",
  unknown: "Draft mode, re-checked each cycle",
};

export function verifiedOn(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export interface AiPolicyTableProps {
  rows: readonly PublicAiPolicy[];
  limit?: number;
  variant: "compact" | "full";
  className?: string;
}

export function AiPolicyTable({ rows, limit, variant, className }: AiPolicyTableProps) {
  if (rows.length === 0) return null;
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  const full = variant === "full";
  const cell = "py-3 pr-4 align-top text-base";
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Schools&rsquo; AI policies, as published on each school&rsquo;s website, with the date we
          checked
        </caption>
        <thead>
          <tr className="border-b border-edge text-sm text-text-soft">
            <th scope="col" className="py-2 pr-4 font-normal">
              School
            </th>
            <th scope="col" className="py-2 pr-4 font-normal">
              Policy
            </th>
            {full ? (
              <th scope="col" className="py-2 pr-4 font-normal">
                What AdmitStory does
              </th>
            ) : null}
            <th scope="col" className="py-2 pr-4 font-normal">
              Checked
            </th>
            {full ? (
              <th scope="col" className="py-2 font-normal">
                <span className="sr-only">The school&rsquo;s own page</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {shown.map((row) => (
            <tr key={`${row.schoolSlug}-${row.cycle}`}>
              <th scope="row" className={cx(cell, "font-medium text-text")}>
                {row.schoolName}
              </th>
              <td className={cx(cell, "text-text")}>{STANCE_WORDS[row.stance]}</td>
              {full ? (
                <td className={cx(cell, "text-text-soft")}>{STANCE_MODE[row.stance]}</td>
              ) : null}
              <td className={cx(cell, "whitespace-nowrap text-text-soft tabular-nums")}>
                <time dateTime={row.verifiedAt.toISOString().slice(0, 10)}>
                  {verifiedOn(row.verifiedAt)}
                </time>
              </td>
              {full ? (
                <td className="py-1 align-top">
                  {row.sourceUrl ? (
                    <a
                      href={row.sourceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="inline-flex min-h-11 items-center text-signal underline-offset-4 hover:underline"
                    >
                      Policy
                      <span className="sr-only"> for {row.schoolName} (opens in a new tab)</span>
                    </a>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
