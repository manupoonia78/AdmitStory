// Each school's AI policy as we verified it (direction §4.7 and §6; SPEC §4.2), typeset on a
// sheet of paper on /how-it-works#ai-policies. Server component. It renders nothing without rows:
// until Manu verifies the policies the page shows AI_POLICY_FALLBACK instead. Stance and mode are
// in words, never colour.
//
// From 640 px a real table; narrower, each school is a block (name, policy, mode, then the date
// and the link on one line), from the same markup: the cells become blocks and the head hides.

import { HOW_PAGE_COPY } from "../_copy/how-it-works";
import type { PublicAiPolicy } from "@/lib/marketing/public-data";

type Stance = PublicAiPolicy["stance"];

export const STANCE_WORDS: Record<Stance, string> = {
  permitted: "Allows AI help",
  permitted_with_disclosure: "Allows AI help if you disclose it",
  limited: "Limits AI help",
  prohibited: "Doesn’t allow AI-written answers",
  unknown: "No published policy",
};

/**
 * What AdmitStories does for each stance, as apps/web/lib/kit/authorship.ts decides it for written
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

export function AiPolicyTable({ rows }: { rows: readonly PublicAiPolicy[] }) {
  if (rows.length === 0) return null;
  const copy = HOW_PAGE_COPY.policies;
  return (
    <table className="policy-table">
      <caption className="sr-only">{copy.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{copy.school}</th>
          <th scope="col">{copy.policy}</th>
          <th scope="col">{copy.mode}</th>
          <th scope="col">{copy.checked}</th>
          <th scope="col">
            <span className="sr-only">The school&rsquo;s own page</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.schoolSlug}-${row.cycle}`}>
            <th scope="row">{row.schoolName}</th>
            <td>{STANCE_WORDS[row.stance]}</td>
            <td className="policy-mode">{STANCE_MODE[row.stance]}</td>
            <td className="policy-date">
              <time dateTime={row.verifiedAt.toISOString().slice(0, 10)}>
                {verifiedOn(row.verifiedAt)}
              </time>
            </td>
            <td className="policy-link">
              {row.sourceUrl ? (
                <a href={row.sourceUrl} rel="noopener noreferrer" target="_blank">
                  {copy.source}
                  <span className="sr-only"> for {row.schoolName} (opens in a new tab)</span>
                </a>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
