// What School Strategy's pages and routes pass around (spec §5.5, screen E). Plain types only, so
// client components can import them: no Zod, no packages/kb runtime (§6.11's first-load budget).

import type { Citation, HorizonRound } from "@admitstory/ui";

/** One sourced line about a school: "By invitation, 30 min, campus or virtual". */
export interface SourcedLine {
  text: string;
  citation: Citation;
}

/** A round as School Strategy shows it, with where its deadline comes from. */
export interface CardRound extends HorizonRound {
  /** The deadline's calendar date as the pack states it, "2027-01-06". */
  date: string;
  citation: Citation;
}

/**
 * A school as "Add schools" shows it (§5.5): the current cycle's rounds and deadlines, its essays,
 * interview format, verified AI policy stance and pack freshness. A school without a published pack
 * carries none of these, because nothing unverified is shown.
 */
export interface SchoolCard {
  schoolId: string;
  name: string;
  shortName: string;
  cycleId: string | null;
  cycle: string | null;
  pack: "published" | "coming_soon";
  packVersion: number | null;
  /** When the published version was verified and published, "2026-09-12". */
  verifiedOn: string | null;
  rounds: CardRound[];
  essays: { count: number; lengths: string[]; citation: Citation } | null;
  interview: SourcedLine | null;
  aiPolicy: SourcedLine | null;
  /** The applicant asked us to cover this school ("Pack coming soon" only). */
  voted: boolean;
  /** The applicant's user_schools id when the school is on their list. */
  userSchoolId: string | null;
}

/** Where a kit preview stands for one school (GET /api/user-schools/:id/preview). */
export type PreviewState =
  | { state: "coming_soon" }
  | { state: "idle" }
  | { state: "running"; since: string }
  | { state: "failed"; at: string }
  | { state: "budget" }
  | { state: "ready"; preview: PreviewView; stale: boolean; updating: boolean };

/** The preview as the page renders it: titles only, drafts locked (§5.5). */
export interface PreviewView {
  headline: string;
  support: string[];
  fileMap: { key: string; deliverable: string; story: string | null }[];
  deliverables: { key: string; title: string; limit: string; story: string | null }[];
  builtAt: string;
}

/** One school on the applicant's list, as the list and its controls show it. */
export interface StrategyRow {
  userSchoolId: string;
  schoolId: string;
  name: string;
  shortName: string;
  cycle: string;
  pack: "published" | "coming_soon";
  round: string | null;
  isReapplicant: boolean;
  previousOutcome: string | null;
  status: string;
  /** "Verified 12 Sep 2026" for a published pack. */
  verified: string | null;
  roundOptions: { value: string; label: string }[];
}
