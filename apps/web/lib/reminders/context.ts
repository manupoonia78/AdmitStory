import "server-only";

import {
  getInviteStatus,
  listLorBriefs,
  listRecommenderStatuses,
  getRecommender,
  type DbExecutor,
  type InviteStatusRow,
  type RecommenderRow,
} from "@admitstory/db";
import { COMMON_GROUP_KEY } from "@admitstory/shared/kit";
import {
  applicantIdentity,
  recommenderSchools,
  type ApplicantIdentity,
} from "@/lib/recommenders/schools";
import type { RecommenderSchool } from "@/lib/recommenders/schools";

// Everything the invitation and the check-ins are made of (Phase 6 plan §7), gathered once so the
// preview the applicant reads and the email that goes out are rendered from the same facts.
//
// Nothing here reads what the recommender wrote: `submitted`, `openedAt` and `progressAt` come
// from listRecommenderStatuses, which selects dates and marks only (§14.3).

export interface RecommenderEmailContext {
  recommender: RecommenderRow;
  identity: ApplicantIdentity;
  /** The schools this recommender writes for, in the applicant's list order. */
  schools: RecommenderSchool[];
  /** Their known deadlines as ISO dates, earliest first, without repeats. */
  deadlines: string[];
  /** The ready brief's cover note, in the applicant's voice; "" when no brief is ready. */
  coverNote: string;
  /** At least one brief is built, so an invitation has something to carry. */
  hasReadyBrief: boolean;
  invite: InviteStatusRow | null;
  /** school_cycle_id → ISO time the recommender marked it submitted. */
  submitted: Record<string, string>;
  openedAt: Date | null;
  progressAt: Date | null;
}

/** Null when the recommender isn't the caller's (or is archived). */
export async function reminderContext(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<RecommenderEmailContext | null> {
  const recommender = await getRecommender(db, userId, recommenderId);
  if (!recommender) return null;
  const [identity, schools, briefs, invite, statuses] = await Promise.all([
    applicantIdentity(db, userId),
    recommenderSchools(db, userId, { userSchoolIds: recommender.userSchoolIds, now }),
    listLorBriefs(db, userId, { recommenderId: recommender.id }),
    getInviteStatus(db, userId, recommender.id, now),
    listRecommenderStatuses(db, userId, now),
  ]);
  const ready = briefs.filter((brief) => brief.status === "ready" && brief.content);
  const cover = ready.find((brief) => brief.groupKey === COMMON_GROUP_KEY) ?? ready[0] ?? null;
  const status = statuses.find((row) => row.recommenderId === recommender.id) ?? null;
  return {
    recommender,
    identity,
    schools,
    deadlines: [...new Set(schools.map((s) => s.deadline).filter((d): d is string => !!d))].sort(),
    coverNote: cover?.content?.cover_note?.trim() ?? "",
    hasReadyBrief: ready.length > 0,
    invite,
    submitted: status?.submitted ?? {},
    openedAt: status?.openedAt ?? null,
    progressAt: status?.progressAt ?? null,
  };
}

/** The people block both email templates take. */
export function emailPeople(context: RecommenderEmailContext) {
  const name = context.recommender.name.trim();
  return {
    applicant: { name: context.identity.name, firstName: context.identity.firstName },
    recommender: { name, firstName: name.split(/\s+/)[0] ?? name },
  };
}

/** The schools a check-in is about: those sharing its deadline, else every school. */
export function schoolsForEmail(
  context: RecommenderEmailContext,
  schoolCycleIds?: readonly string[],
): { name: string; deadline: string | null }[] {
  const wanted = schoolCycleIds && schoolCycleIds.length > 0 ? new Set(schoolCycleIds) : null;
  return context.schools
    .filter((school) => !wanted || wanted.has(school.schoolCycleId))
    .map((school) => ({ name: school.name, deadline: school.deadline }));
}
