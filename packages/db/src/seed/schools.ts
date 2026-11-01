// Seed data for Phase 3: the Appendix H schools with a draft 2026-27 cycle each, and the §14.2 AI
// policy seeds. Both are idempotent. AI policies are seeded UNVERIFIED (verified_at null): they come
// from a press summary and stay hidden from applicants until Manu checks each against the school's
// own site (§14.2, §0 "every school-specific fact carries a source and a verified date").
//
// Cities and websites are deliberately left empty: they are school facts, and the admin fills them
// with a source. Country codes are the schools' home countries, needed for the region filters.

import { SEED_SCHOOLS, spokenSchoolName, type SeedSchool } from "@admitstory/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "../client";
import { aiPolicies, schoolCycles, schools, type AiStance } from "../schema";

export const SEED_CYCLE = "2026-27";

/** The Poets&Quants May 2026 summary the §14.2 seeds come from (Appendix K). */
export const AI_POLICY_SEED_SOURCE =
  "https://poetsandquants.com/2026/05/26/the-mba-applicants-guide-to-ai-in-2026-whats-allowed-whats-risky-and-what-to-avoid/";

export interface SchoolIdentity {
  slug: string;
  shortName: string;
  /** ISO 3166-1 alpha-2; null when it cannot be derived. */
  country: string | null;
}

/** Short names and countries for the Appendix H list, keyed by the name as the spec writes it. */
const IDENTITY: Readonly<Record<string, Omit<SchoolIdentity, "slug">>> = {
  "Harvard Business School": { shortName: "HBS", country: "US" },
  "Stanford GSB": { shortName: "Stanford GSB", country: "US" },
  "Wharton (Penn)": { shortName: "Wharton", country: "US" },
  "Chicago Booth": { shortName: "Booth", country: "US" },
  "Northwestern Kellogg": { shortName: "Kellogg", country: "US" },
  "MIT Sloan": { shortName: "MIT Sloan", country: "US" },
  "Columbia Business School": { shortName: "Columbia", country: "US" },
  "Berkeley Haas": { shortName: "Haas", country: "US" },
  "Dartmouth Tuck": { shortName: "Tuck", country: "US" },
  "Yale SOM": { shortName: "Yale SOM", country: "US" },
  "Michigan Ross": { shortName: "Ross", country: "US" },
  "Duke Fuqua": { shortName: "Fuqua", country: "US" },
  "UVA Darden": { shortName: "Darden", country: "US" },
  "NYU Stern": { shortName: "Stern", country: "US" },
  "Cornell Johnson": { shortName: "Johnson", country: "US" },
  "UCLA Anderson": { shortName: "Anderson", country: "US" },
  "CMU Tepper": { shortName: "Tepper", country: "US" },
  "UT Austin McCombs": { shortName: "McCombs", country: "US" },
  "USC Marshall": { shortName: "Marshall", country: "US" },
  "UW Foster": { shortName: "Foster", country: "US" },
  "UNC Kenan-Flagler": { shortName: "Kenan-Flagler", country: "US" },
  "Emory Goizueta": { shortName: "Goizueta", country: "US" },
  "Vanderbilt Owen": { shortName: "Owen", country: "US" },
  "Georgia Tech Scheller": { shortName: "Scheller", country: "US" },
  "Indiana Kelley": { shortName: "Kelley", country: "US" },
  "Rice Jones": { shortName: "Rice Jones", country: "US" },
  "WashU Olin": { shortName: "Olin", country: "US" },
  "Notre Dame Mendoza": { shortName: "Mendoza", country: "US" },
  "Rochester Simon": { shortName: "Simon", country: "US" },
  "Minnesota Carlson": { shortName: "Carlson", country: "US" },
  INSEAD: { shortName: "INSEAD", country: "FR" },
  "London Business School": { shortName: "LBS", country: "GB" },
  "HEC Paris": { shortName: "HEC Paris", country: "FR" },
  IESE: { shortName: "IESE", country: "ES" },
  "IE Business School": { shortName: "IE", country: "ES" },
  ESADE: { shortName: "ESADE", country: "ES" },
  "SDA Bocconi": { shortName: "Bocconi", country: "IT" },
  "Oxford Saïd": { shortName: "Oxford Saïd", country: "GB" },
  "Cambridge Judge": { shortName: "Cambridge Judge", country: "GB" },
  IMD: { shortName: "IMD", country: "CH" },
  "ISB (India)": { shortName: "ISB", country: "IN" },
  "NUS Business School": { shortName: "NUS", country: "SG" },
  HKUST: { shortName: "HKUST", country: "HK" },
  CEIBS: { shortName: "CEIBS", country: "CN" },
  "Melbourne Business School": { shortName: "MBS", country: "AU" },
  "Ivey (Canada)": { shortName: "Ivey", country: "CA" },
  "Rotman (Canada)": { shortName: "Rotman", country: "CA" },
};

/** ASCII, lower case, hyphenated; the parenthetical is dropped ("Oxford Saïd" → "oxford-said"). */
export function schoolSlug(name: string): string {
  return spokenSchoolName(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function schoolIdentity(seed: SeedSchool): SchoolIdentity {
  const known = IDENTITY[seed.name];
  return {
    slug: schoolSlug(seed.name),
    shortName: known?.shortName ?? spokenSchoolName(seed.name),
    country: known?.country ?? null,
  };
}

/**
 * Upserts the schools by slug and gives each a draft cycle. Re-running changes nothing but the
 * name and region (the list's own fields); short names, countries and anything the admin added
 * are left alone. Returns how many rows were new.
 */
export async function seedSchools(
  db: DbExecutor,
  list: readonly SeedSchool[] = SEED_SCHOOLS,
  cycle: string = SEED_CYCLE,
): Promise<{ schools: number; cycles: number; schoolIds: string[] }> {
  if (list.length === 0) return { schools: 0, cycles: 0, schoolIds: [] };
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(schools)
      .values(
        list.map((seed) => {
          const identity = schoolIdentity(seed);
          return { ...identity, name: seed.name, region: seed.region };
        }),
      )
      .onConflictDoUpdate({
        target: schools.slug,
        set: { name: sql`excluded.name`, region: sql`excluded.region` },
      })
      // xmax = 0 only for rows this statement inserted.
      .returning({ id: schools.id, inserted: sql<boolean>`(xmax = 0)` });
    const cycles = await tx
      .insert(schoolCycles)
      .values(rows.map((row) => ({ schoolId: row.id, cycle, status: "draft" as const })))
      .onConflictDoNothing({ target: [schoolCycles.schoolId, schoolCycles.cycle] })
      .returning({ id: schoolCycles.id });
    return {
      schools: rows.filter((r) => r.inserted).length,
      cycles: cycles.length,
      schoolIds: rows.map((r) => r.id),
    };
  });
}

interface PolicySeed {
  school: string;
  stance: AiStance;
  appliesTo: ("essays" | "video" | "recommendations")[];
  /** What the press summary said, kept for Manu's re-check. Never shown to applicants. */
  summary: string;
}

/** Spec §14.2's seed values, as summarised there from Poets&Quants (May 2026). */
const POLICY_SEEDS: readonly PolicySeed[] = [
  {
    school: "Harvard Business School",
    stance: "permitted_with_disclosure",
    appliesTo: ["essays"],
    summary: "Permitted with disclosure: a yes/no question plus a short description.",
  },
  {
    school: "Northwestern Kellogg",
    stance: "permitted_with_disclosure",
    appliesTo: ["essays"],
    summary: "Permitted as an aid; cite the tool.",
  },
  {
    school: "London Business School",
    stance: "permitted_with_disclosure",
    appliesTo: ["essays"],
    summary: "Reference AI help in a footnote.",
  },
  {
    school: "Michigan Ross",
    stance: "permitted_with_disclosure",
    appliesTo: ["essays"],
    summary: "In-text citation required.",
  },
  {
    school: "Yale SOM",
    stance: "limited",
    appliesTo: ["essays", "video"],
    summary: "AI must not be the primary source of content; no scripting of video essays.",
  },
  {
    school: "Columbia Business School",
    stance: "limited",
    appliesTo: ["essays"],
    summary: "Ideas and editing yes, complete responses no.",
  },
  {
    school: "Wharton (Penn)",
    stance: "limited",
    appliesTo: ["essays"],
    summary: "Treat AI like another person's writing; may use AI detection.",
  },
  {
    school: "Stanford GSB",
    stance: "prohibited",
    appliesTo: ["essays"],
    summary: "Prohibited.",
  },
  { school: "NYU Stern", stance: "prohibited", appliesTo: ["essays"], summary: "Prohibited." },
  {
    school: "Duke Fuqua",
    stance: "unknown",
    appliesTo: [],
    summary: "Runs plagiarism detection; no stance stated in the summary.",
  },
  {
    school: "Oxford Saïd",
    stance: "unknown",
    appliesTo: [],
    summary: "Runs plagiarism detection; no stance stated in the summary.",
  },
  {
    school: "MIT Sloan",
    stance: "unknown",
    appliesTo: [],
    summary: "No published AI-specific policy at the time; re-check each cycle.",
  },
  {
    school: "Chicago Booth",
    stance: "unknown",
    appliesTo: [],
    summary: "No published AI-specific policy at the time; re-check each cycle.",
  },
  {
    school: "INSEAD",
    stance: "unknown",
    appliesTo: [],
    summary: "No published AI-specific policy at the time; re-check each cycle.",
  },
];

/**
 * Seeds the §14.2 policies on each school's seed cycle, UNVERIFIED. Never overwrites a policy that
 * already exists, so an admin's verified entry survives a re-run. Run seedSchools first; schools
 * without a seed cycle are counted as skipped.
 */
export async function seedAiPolicies(
  db: DbExecutor,
  cycle: string = SEED_CYCLE,
): Promise<{ inserted: number; skipped: number }> {
  const slugs = POLICY_SEEDS.map((p) => schoolSlug(p.school));
  const cycles = await db
    .select({ id: schoolCycles.id, slug: schools.slug })
    .from(schoolCycles)
    .innerJoin(schools, eq(schools.id, schoolCycles.schoolId))
    .where(and(inArray(schools.slug, slugs), eq(schoolCycles.cycle, cycle)));
  const cycleBySlug = new Map(cycles.map((c) => [c.slug, c.id] as const));

  const values = POLICY_SEEDS.flatMap((seed) => {
    const cycleId = cycleBySlug.get(schoolSlug(seed.school));
    if (!cycleId) return [];
    return [
      {
        schoolCycleId: cycleId,
        stance: seed.stance,
        appliesTo: seed.appliesTo,
        disclosureText: null,
        sourceUrl: AI_POLICY_SEED_SOURCE,
        verifiedAt: null,
        verifiedBy: null,
        notes: `UNVERIFIED seed from Poets&Quants (May 2026): ${seed.summary} Re-verify against the school's own site before publishing (spec §14.2).`,
      },
    ];
  });
  if (values.length === 0) return { inserted: 0, skipped: POLICY_SEEDS.length };
  const inserted = await db
    .insert(aiPolicies)
    .values(values)
    .onConflictDoNothing({ target: aiPolicies.schoolCycleId })
    .returning({ id: aiPolicies.id });
  return { inserted: inserted.length, skipped: POLICY_SEEDS.length - values.length };
}

/** For tests: every seed school name the policy list refers to. */
export const aiPolicySeedSchools = (): string[] => POLICY_SEEDS.map((p) => p.school);
