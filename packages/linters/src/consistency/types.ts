// The cross-document consistency check (spec §5.10, canon FORM-01): titles, dates, employer names,
// team sizes and numbers identical across the résumé, the form entries, the essays and short
// answers, and (from Phase 6) the recommender briefs, against the Fact Sheet. Pure code, no model.

import type { FactRef } from "../types";

/** Where a piece of text lives, so a finding can link to it and a one-click fix can reach it. */
export type ConsistencyDocKind = "resume" | "form" | "essay" | "brief";

export interface ConsistencySegment {
  /**
   * Addresses the text inside its document: a résumé bullet id ("b4"), a role field
   * ("r1.title", "r1.dates", "r1.organisation"), a form item ("activities/i2") or a draft
   * paragraph ("p3").
   */
  ref: string;
  text: string;
}

export interface ConsistencyDoc {
  /** Unique across the input: "resume", a form section key, a deliverable id. */
  id: string;
  kind: ConsistencyDocKind;
  /** What the applicant calls it: "Resume", "Form: Employment history", "Essay 1". */
  label: string;
  segments: ConsistencySegment[];
}

/**
 * A role as the résumé states it (structured), so a title or date range is compared per employer
 * rather than guessed from prose. Field refs are "r1.title" etc. in the résumé doc.
 */
export interface ConsistencyRole {
  ref: string;
  organisation: string;
  title: string | null;
  dates: string | null;
}

export interface ConsistencyInput {
  facts: readonly FactRef[];
  /** The résumé's roles, when a résumé was reviewed. */
  roles?: readonly ConsistencyRole[];
  docs: readonly ConsistencyDoc[];
  /** Finding ids the applicant marked "these are different things". */
  dismissed?: ReadonlySet<string>;
}

export const CONSISTENCY_SUBJECTS = ["employer", "title", "date", "team_size", "number"] as const;
export type ConsistencySubject = (typeof CONSISTENCY_SUBJECTS)[number];

export interface ConsistencyValue {
  /** The value as written there ("Meridian Health", "April 2024", "13"). */
  said: string;
  /** "fact_sheet" for the Fact Sheet's approved phrasing, else the doc id. */
  docId: string;
  docKind: ConsistencyDocKind | "fact_sheet";
  docLabel: string;
  /** The segment ref (or the fact code for the Fact Sheet). */
  ref: string;
  /** A short excerpt around the value, for the finding row. */
  excerpt: string;
}

export interface ConsistencyFinding {
  /** Stable fingerprint (subject + the thing compared + the sorted values), for dismissals. */
  id: string;
  rule_id: `consistency.${ConsistencySubject}`;
  severity: "must";
  subject: ConsistencySubject;
  /** What is being compared, in words: "Your title at Meridian Health Systems", "Team size". */
  what: string;
  /** Two or more places that disagree; the Fact Sheet first when it is one of them. */
  values: ConsistencyValue[];
  /** The Fact Sheet's approved phrasing, when there is one. The one-click fix uses it. */
  expected: string | null;
  /** One plain sentence (§6.9): `Your resume says "13"; Essay 2 says "15".` */
  explanation: string;
  fix_hint: string;
}
