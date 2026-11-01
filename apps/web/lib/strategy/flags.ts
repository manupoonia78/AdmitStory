// Honest flags and the round planner (spec §5.5). Flags come from two places: the medians, computed
// in code, and strategy.school_fit's honest_flags, each kept only when its K code resolves to a
// source the page can show. Neither ever states odds (§14.5).

import type { SchoolPack } from "@admitstory/kb/types";
import { compareToMedian } from "@admitstory/shared/kit";
import type { HonestFlag, PlannedApplication } from "@admitstory/ui";
import { applicantTestKind, type ComparisonApplicant } from "./comparison";
import { citationFor, firstCitation, packRounds, shortDate, writtenPrompts } from "./pack";
import type { StoredFit } from "./stored-fit";

export interface FlagSchool {
  id: string;
  name: string;
  pack: SchoolPack | null;
  fit: StoredFit | null;
}

/** Words that make a flag a risk to the application rather than something worth knowing. */
const RISK = /\b(risk|risky|below|few|fewer|small share|unlikely|late|competitive|thin)\b/i;

export function honestFlags(
  schools: readonly FlagSchool[],
  applicant: ComparisonApplicant,
): HonestFlag[] {
  const flags: HonestFlag[] = [];
  for (const school of schools) {
    const pack = school.pack;
    if (!pack) continue;

    const profile = pack.class_profile;
    const classCitation = profile
      ? citationFor(pack, profile, { label: "Class profile", year: profile.class_year })
      : null;
    if (profile && classCitation) {
      const standing = compareToMedian(applicant.numbers, profile);
      const kind = applicantTestKind(applicant.numbers);
      const testName = kind === "gre" ? "GRE" : "GMAT";
      if (standing.test === "below")
        flags.push({
          id: `${school.id}:median-test`,
          tone: "risk",
          text: `Your ${testName} score is below ${school.name}'s class median. A strong quantitative record elsewhere in your file matters more here.`,
          citation: classCitation,
        });
      if (standing.gpa === "below")
        flags.push({
          id: `${school.id}:median-gpa`,
          tone: "note",
          text: `Your GPA is below ${school.name}'s class median. Recent coursework or a test score can speak to your academics.`,
          citation: classCitation,
        });
    }

    (school.fit?.output?.honest_flags ?? []).forEach((flag, index) => {
      const citation = firstCitation(pack, flag.cites, school.fit?.retrieval ?? []);
      if (!citation) return;
      const text = flag.text.includes(school.name) ? flag.text : `${school.name}: ${flag.text}`;
      flags.push({
        id: `${school.id}:fit-${index}`,
        tone: RISK.test(flag.text) ? "risk" : "note",
        text,
        citation,
      });
    });
  }
  return flags;
}

/* Round planner ------------------------------------------------------------------------------ */

export interface PlannerSchool {
  id: string;
  name: string;
  pack: SchoolPack | null;
  /** The round the applicant chose ("R2"), or null to plan for the next one still open. */
  round: string | null;
}

const DAY_MS = 86_400_000;

/** Weeks of work for a school: one to settle the story, then one per written prompt. */
export function effortWeeks(prompts: number): number {
  return Math.max(2, 1 + prompts);
}

/**
 * Which schools to do first (§5.5): each school's chosen round, or the next open one, starting
 * early enough for its essays. Ordered by when work should start.
 */
export function plannerItems(
  schools: readonly PlannerSchool[],
  now: Date,
  timeZone: string,
): PlannedApplication[] {
  const items: Omit<PlannedApplication, "order">[] = [];
  for (const school of schools) {
    if (!school.pack) continue;
    const rounds = packRounds(school.pack, timeZone);
    const chosen =
      rounds.find((r) => r.short === school.round || r.id === school.round) ??
      rounds.find((r) => new Date(r.deadline).getTime() >= now.getTime());
    if (!chosen) continue;
    const prompts = writtenPrompts(school.pack).filter((p) => p.required).length;
    const weeks = effortWeeks(prompts);
    const deadlineMs = new Date(chosen.deadline).getTime();
    // A school claim in the note carries its own source too.
    const interview = school.pack.interview;
    const interviewCitation =
      interview?.invitation === "guaranteed_if_by_date"
        ? citationFor(school.pack, interview, { label: "Interview format" })
        : null;
    items.push({
      schoolId: school.id,
      schoolName: school.name,
      roundLabel: chosen.label,
      deadline: chosen.deadline,
      startBy: new Date(deadlineMs - weeks * 7 * DAY_MS).toISOString(),
      effort: `about ${weeks} weeks for ${prompts} ${prompts === 1 ? "essay" : "essays"}`,
      ...(interviewCitation
        ? {
            note: `Applying by the school's stated date guarantees an interview (interview format, verified ${shortDate(interviewCitation.verifiedOn ?? "")})`,
          }
        : {}),
      citation: chosen.citation,
    });
  }
  return items
    .sort((a, b) => a.startBy.localeCompare(b.startBy))
    .map((item, index) => ({ ...item, order: index + 1 }));
}
