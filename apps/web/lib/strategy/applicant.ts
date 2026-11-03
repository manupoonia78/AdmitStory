// The applicant as School Strategy sees them (spec §5.5): their numbers for the median comparison,
// the role they're aiming for, their brand traits and a one-line summary for strategy.school_fit.
// Pure: the loader in server.ts reads the rows and passes them here.

import { isTraitId, type TraitId } from "@admitstory/shared";
import type { ApplicantNumbers } from "@admitstory/shared/kit";

/**
 * Canonical target functions, matched on the applicant's own short-term goal. Employment reports
 * group by function, so this is what the comparison needs; the applicant's wording stays theirs
 * everywhere else.
 */
const FUNCTIONS: readonly { label: string; pattern: RegExp }[] = [
  { label: "Product management", pattern: /\bproduct\b/i },
  { label: "Consulting", pattern: /\bconsult/i },
  { label: "Investment banking", pattern: /\binvestment bank/i },
  { label: "Private equity", pattern: /\bprivate equity\b|\bbuy-?out/i },
  { label: "Venture capital", pattern: /\bventure\b/i },
  { label: "Finance", pattern: /\bfinanc|\binvest|\basset management\b/i },
  { label: "Marketing", pattern: /\bmarketing\b|\bbrand\b/i },
  { label: "Technology", pattern: /\btech(nology)?\b|\bsoftware\b/i },
  { label: "Healthcare", pattern: /\bhealth|\bhospital|\bpharma|\bbiotech/i },
  { label: "Entrepreneurship", pattern: /\bfound(er|ing)\b|\bstart(-| )?up\b|\bentrepreneur/i },
  { label: "Operations", pattern: /\boperations\b|\bsupply chain\b/i },
  { label: "Social impact", pattern: /\bsocial impact\b|\bnon-?profit\b|\bpublic sector\b/i },
  { label: "General management", pattern: /\bgeneral manag|\bstrategy\b|\bleadership program/i },
];

/** "Product management" from "Lead product for a health-data company", or null. */
export function targetFunctionFrom(goal: string | null | undefined): string | null {
  if (!goal) return null;
  return FUNCTIONS.find((f) => f.pattern.test(goal))?.label ?? null;
}

export interface ApplicantRows {
  profile: {
    testType: string | null;
    testScore: number | null;
    gpa: number | null;
    gpaScale: number | null;
    yearsExperience: number | null;
    country: string | null;
    timezone: string | null;
  } | null;
  goals: { shortTerm: string | null } | null;
  brand: { traits: readonly { traitId: string }[] } | null;
  facts: readonly { key: string; value: string; consentToUse: boolean }[];
}

export interface StrategyApplicant {
  numbers: ApplicantNumbers;
  targetFunction: string | null;
  brandTraits: TraitId[];
  /** ISO 3166-1 alpha-2, or null. */
  country: string | null;
  timeZone: string;
  /** One or two lines for strategy.school_fit: role, years, country, direction. No names. */
  summary: string;
}

/** A valid IANA zone, or UTC. Deadlines are shown in the applicant's zone (§5.5). */
export function safeTimeZone(zone: string | null | undefined): string {
  if (!zone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

export function strategyApplicant(rows: ApplicantRows): StrategyApplicant {
  const profile = rows.profile;
  const numbers: ApplicantNumbers = {
    test:
      profile?.testType && profile.testScore != null
        ? { type: profile.testType, score: profile.testScore }
        : null,
    gpa:
      profile?.gpa != null && profile.gpaScale != null
        ? { value: profile.gpa, scale: profile.gpaScale }
        : null,
    yearsExperience: profile?.yearsExperience ?? null,
  };
  const targetFunction = targetFunctionFrom(rows.goals?.shortTerm);
  const brandTraits = (rows.brand?.traits ?? [])
    .map((t) => t.traitId)
    .filter(isTraitId)
    .slice(0, 4);
  // Only the applicant's job title, never an employer or a person: the summary leaves the dossier.
  const title = rows.facts.find((f) => f.consentToUse && f.key === "title_current")?.value ?? null;
  const parts = [
    title ? `Currently ${title.slice(0, 120)}` : "Role not stated yet",
    numbers.yearsExperience != null ? `${numbers.yearsExperience} years' experience` : null,
    profile?.country ? `based in ${profile.country}` : null,
    targetFunction ? `aiming for ${targetFunction.toLowerCase()}` : "target role not stated yet",
  ].filter(Boolean);
  return {
    numbers,
    targetFunction,
    brandTraits,
    country: profile?.country ?? null,
    timeZone: safeTimeZone(profile?.timezone),
    summary: `${parts.join(", ")}.`,
  };
}

/** Whether the applicant would apply as an international candidate; null when either is unknown. */
export function isInternational(applicantCountry: string | null, schoolCountry: string | null) {
  if (!applicantCountry || !schoolCountry) return null;
  return applicantCountry.trim().toUpperCase() !== schoolCountry.trim().toUpperCase();
}
