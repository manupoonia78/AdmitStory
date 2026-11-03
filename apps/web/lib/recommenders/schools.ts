import "server-only";

import {
  getAccountIdentity,
  getVerifiedAiPolicy,
  hasEntitlement,
  listUserSchools,
  type DbExecutor,
} from "@admitstory/db";
import type { SchoolPack } from "@admitstory/kb/types";
import {
  COMMON_LOR_QUESTIONS,
  type BriefQuestion,
  type GroupableSchool,
  type LorFormat,
} from "@admitstory/shared/kit";
import { asPack, limitText } from "@/lib/strategy/pack";
import { latestPack } from "@/lib/strategy/server";

// The applicant's schools as the Recommender Kit sees them (Phase 6 plan §5, foundation): for each
// school a recommender writes for, its deadline, the letter format, the questions verbatim (the
// pack's own, or the common form's from code, decision 16), how to submit, the pack's notes, the AI
// policy that decides the portal's mode (decision 20) and whether the school's kit is paid for.
// Shared by the brief builder, the reminder schedule, the portal and screen H.

export type LimitRuleView = {
  kind: "words" | "chars_incl_spaces" | "chars_excl_spaces";
  value: number;
};

export interface RecommenderSchoolQuestion extends BriefQuestion {
  /** The counting rule, for the portal's live count. Null when the school sets none. */
  rule: LimitRuleView | null;
}

export interface RecommenderSchool {
  userSchoolId: string;
  schoolCycleId: string;
  /** Short name ("Halvorsen"). */
  name: string;
  fullName: string;
  cycle: string;
  /** The applicant's round ("R1"), or null. */
  round: string | null;
  /** ISO date: the applicant's round's deadline, else the next round's, else null. */
  deadline: string | null;
  format: LorFormat;
  /** Letters the school asks for (the pack's count), or null when the pack doesn't say. */
  needed: number | null;
  questions: RecommenderSchoolQuestion[];
  packNotes: string[];
  /** The school's AI policy for recommendations: verified registry row first, else the pack's. */
  policy: { stance: string; applies_to: string[] } | null;
  /** An active School Kit entitlement for this school-cycle. */
  paid: boolean;
  /** The applicant has marked the application submitted (or moved past it). */
  applicationSubmitted: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const PAST_SUBMISSION = new Set(["submitted", "interview", "admitted", "waitlisted", "denied"]);

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The applicant's round's deadline, else the next upcoming round's, else the last one's. */
export function deadlineFor(
  pack: SchoolPack | null,
  cycleRounds: readonly { name: string; deadline: string | null }[],
  round: string | null,
  now: Date = new Date(),
): string | null {
  const rounds = [
    ...(pack?.rounds ?? []).map((r) => ({ name: r.name, deadline: r.deadline })),
    ...cycleRounds,
  ]
    .filter(
      (r): r is { name: string; deadline: string } => !!r.deadline && ISO_DATE.test(r.deadline),
    )
    .map((r) => ({ name: r.name, deadline: r.deadline.slice(0, 10) }));
  if (rounds.length === 0) return null;
  if (round) {
    const chosen = rounds.find((r) => r.name.trim().toLowerCase() === round.trim().toLowerCase());
    if (chosen) return chosen.deadline;
  }
  const dates = [...new Set(rounds.map((r) => r.deadline))].sort();
  const today = todayIso(now);
  return dates.find((d) => d >= today) ?? dates.at(-1) ?? null;
}

/** The letter's questions: the pack's own when it publishes them, else the common form's. */
export function questionsFor(pack: SchoolPack | null): {
  format: LorFormat;
  questions: RecommenderSchoolQuestion[];
} {
  const rec = pack?.application.recommendations ?? null;
  const own = rec?.format === "school_specific" ? rec.questions : [];
  if (rec && own.length > 0)
    return {
      format: "school_specific",
      questions: own.map((q, i) => ({
        id: `q${i + 1}`,
        text: q.text_verbatim,
        limit: q.limit ? limitText(q.limit) : null,
        source: "pack",
        rule: q.limit ? { kind: q.limit.kind, value: q.limit.value } : null,
      })),
    };
  return {
    format: rec?.format === "gmac_common" ? "gmac_common" : rec ? "school_specific" : "unknown",
    questions: COMMON_LOR_QUESTIONS.map((q) => ({
      id: q.id,
      text: q.text,
      limit: q.limit,
      source: "common_form",
      rule: q.words ? { kind: "words", value: q.words } : null,
    })),
  };
}

/** Deterministic "how to submit" copy (decision 14), in plain words. */
export function howToSubmitFor(
  school: Pick<RecommenderSchool, "name" | "format">,
  applicantFirstName: string,
): string {
  const who = applicantFirstName || "the applicant";
  return school.format === "school_specific"
    ? `${school.name} emails you a link to its own recommendation form once ${who} names you in the application. Paste your answers into that form.`
    : `${school.name} uses the common letter of recommendation form. The school emails you a link to it once ${who} names you in the application.`;
}

/** As a GroupableSchool for `schoolGroups` (decision 15). */
export function groupable(school: RecommenderSchool): GroupableSchool {
  return {
    schoolCycleId: school.schoolCycleId,
    format: school.format,
    questions: school.format === "school_specific" ? school.questions.length : 0,
  };
}

/**
 * The applicant's schools for the Recommender Kit. `userSchoolIds` keeps only those (a
 * recommender's schools), in the applicant's list order; without it, every school on the list.
 */
export async function recommenderSchools(
  db: DbExecutor,
  userId: string,
  options: { userSchoolIds?: readonly string[]; now?: Date } = {},
): Promise<RecommenderSchool[]> {
  const now = options.now ?? new Date();
  const wanted = options.userSchoolIds ? new Set(options.userSchoolIds) : null;
  const rows = (await listUserSchools(db, userId)).filter((r) => !wanted || wanted.has(r.id));
  return Promise.all(
    rows.map(async (row): Promise<RecommenderSchool> => {
      const [published, registry, paid] = await Promise.all([
        latestPack(db, row.cycle.id),
        getVerifiedAiPolicy(db, row.cycle.id),
        hasEntitlement(db, userId, "school_kit", row.cycle.id),
      ]);
      const pack = published ? asPack(published.data) : null;
      const { format, questions } = questionsFor(pack);
      const rec = pack?.application.recommendations ?? null;
      const policy = registry
        ? { stance: registry.stance, applies_to: [...registry.appliesTo] }
        : pack?.ai_policy
          ? { stance: pack.ai_policy.stance, applies_to: [...pack.ai_policy.applies_to] }
          : null;
      return {
        userSchoolId: row.id,
        schoolCycleId: row.cycle.id,
        name: row.school.shortName || row.school.name,
        fullName: row.school.name,
        cycle: row.cycle.cycle,
        round: row.round,
        deadline: deadlineFor(pack, row.cycle.rounds, row.round, now),
        format,
        needed: rec ? rec.count : null,
        questions,
        packNotes: (rec?.notes ?? []).map((n) => n.text),
        policy,
        paid,
        applicationSubmitted: PAST_SUBMISSION.has(row.status),
      };
    }),
  );
}

export interface ApplicantIdentity {
  /** "Asha Varma": the display name, else the account name, else the email's local part. */
  name: string;
  firstName: string;
  /** The account email: the invite's Reply-To, and the address the applicant may not invite. */
  email: string;
  /** IANA zone, or null (reminders then go at 09:00 UTC). */
  timeZone: string | null;
}

/** Who the applicant is to their recommenders. Never throws for a missing profile. */
export async function applicantIdentity(
  db: DbExecutor,
  userId: string,
): Promise<ApplicantIdentity> {
  const row = await getAccountIdentity(db, userId);
  const email = row?.email ?? "";
  const name =
    row?.displayName?.trim() || row?.name?.trim() || email.split("@")[0] || "Your applicant";
  const firstName = name.split(/\s+/)[0] ?? name;
  return { name, firstName, email, timeZone: row?.timeZone ?? null };
}
