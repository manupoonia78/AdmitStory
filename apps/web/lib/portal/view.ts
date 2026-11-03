import "server-only";

import {
  getDb,
  getLorBrief,
  getRecommender,
  readPortalWorkspace,
  type LorBriefRow,
  type PortalAccess,
  type PortalWorkspace,
  type RecommenderRow,
} from "@admitstory/db";
import {
  PORTAL_LIMITS,
  RELATIONSHIP_LABELS,
  briefSections,
  recommenderModeFor,
  schoolGroups,
  type BriefSection,
  type PortalMode,
  type PortalView,
} from "@admitstory/shared/kit";
import { coachPolicyNote } from "@admitstory/ui";
import { ApiError, notFound } from "@/lib/api";
import {
  applicantIdentity,
  groupable,
  recommenderSchools,
  type ApplicantIdentity,
  type RecommenderSchool,
  type RecommenderSchoolQuestion,
} from "@/lib/recommenders/schools";

// What the recommender's page shows (Phase 6 plan §3 PortalView, §8). Assembled from the
// applicant's own material only: the brief they paid for, the schools' published questions, and
// whatever the recommender has written here themselves.
//
// Two things are deliberately absent, and a reader of this file should keep them absent:
//  - no essay, draft, dossier line or form entry of the applicant's: a recommender sees the brief
//    and nothing more (§5.11, §14.3);
//  - no raw token: the page is reached with one, and never renders it back except in the form
//    actions the route already knows.

/** One school group as the portal works with it: its schools, its questions and its brief. */
export interface PortalGroupContext {
  key: string;
  schools: RecommenderSchool[];
  /** The mode the schools' AI policies force (decision 20), before the recommender's own choice. */
  policyMode: PortalMode;
  policyNote: string | null;
  /** The live questions, with the counting rule the portal's live count uses. */
  questions: RecommenderSchoolQuestion[];
  brief: LorBriefRow | null;
}

export interface PortalContext {
  access: PortalAccess;
  userId: string;
  applicant: ApplicantIdentity;
  recommender: RecommenderRow;
  groups: PortalGroupContext[];
  workspace: PortalWorkspace;
}

const RESTRICTIVE = new Set(["limited", "prohibited"]);

/** Everything the portal's routes work from, read once per request. */
export async function portalContext(access: PortalAccess): Promise<PortalContext> {
  const db = getDb();
  const recommender = await getRecommender(db, access.userId, access.recommenderId);
  // The applicant archived or deleted them between the link being issued and this request.
  if (!recommender) notFound("That page");

  const [applicant, schools, workspace] = await Promise.all([
    applicantIdentity(db, access.userId),
    recommenderSchools(db, access.userId, { userSchoolIds: recommender.userSchoolIds }),
    readPortalWorkspace(db, access),
  ]);
  const byId = new Map(schools.map((school) => [school.schoolCycleId, school]));

  const groups = await Promise.all(
    schoolGroups(schools.map(groupable)).map(async (group): Promise<PortalGroupContext> => {
      const members = group.schoolCycleIds
        .map((id) => byId.get(id))
        .filter((school): school is RecommenderSchool => Boolean(school));
      const policies = members.map((school) => school.policy).filter((p) => p !== null);
      const restricted = members.filter(
        (school) =>
          school.policy &&
          RESTRICTIVE.has(school.policy.stance) &&
          school.policy.applies_to.includes("recommendations"),
      );
      return {
        key: group.key,
        schools: members,
        policyMode: recommenderModeFor(policies),
        policyNote: restricted.length > 0 ? coachPolicyNote(restricted.map((s) => s.name)) : null,
        questions: members[0]?.questions ?? [],
        brief: await getLorBrief(db, access.userId, access.recommenderId, group.key),
      };
    }),
  );

  return { access, userId: access.userId, applicant, recommender, groups, workspace };
}

/** The group's brief as reading matter for the recommender: no cites, no story codes (§3). */
export function sectionsFor(group: PortalGroupContext): BriefSection[] {
  const row = group.brief;
  if (!row || row.status !== "ready" || !row.content || !row.meta) return [];
  return briefSections(row.content, row.meta, "recommender");
}

/** The mode a group actually runs in: the schools' policy, or the recommender's own choice. */
export const effectiveMode = (group: PortalGroupContext, preferCoach: boolean): PortalMode =>
  preferCoach ? "coach" : group.policyMode;

/** The page's view. Everything the recommender wrote is theirs; the applicant never sees it. */
export function portalView(context: PortalContext): PortalView {
  const { applicant, recommender, workspace } = context;
  const first = recommender.name.split(/\s+/)[0] ?? recommender.name;
  return {
    applicant: { name: applicant.name, firstName: applicant.firstName },
    recommender: { name: recommender.name, firstName: first },
    expiresAt: context.access.expiresAt.toISOString(),
    groups: context.groups.map((group) => ({
      key: group.key,
      schools: group.schools.map((school) => ({
        schoolCycleId: school.schoolCycleId,
        name: school.name,
        deadline: school.deadline,
        submittedAt: workspace.submitted[school.schoolCycleId] ?? null,
      })),
      mode: effectiveMode(group, workspace.preferCoach),
      policyNote: group.policyNote,
      sections: sectionsFor(group),
      questions: group.questions.map((question) => ({
        id: question.id,
        text: question.text,
        limit: question.rule,
      })),
    })),
    notes: workspace.notes,
    letters: workspace.letters,
    voiceSecondsLeft: Math.max(0, PORTAL_LIMITS.voiceSeconds - workspace.voiceSeconds),
    assistsLeft: Math.max(0, PORTAL_LIMITS.assistsTotal - workspace.assistCount),
    preferCoach: workspace.preferCoach,
  };
}

/** The page's view in one call. */
export async function loadPortalView(access: PortalAccess): Promise<PortalView> {
  return portalView(await portalContext(access));
}

/** The group and question a request names, or a 404 (a wrong id never says what exists). */
export function questionIn(
  context: PortalContext,
  groupKey: string,
  questionId: string,
): { group: PortalGroupContext; question: RecommenderSchoolQuestion } {
  const group = context.groups.find((candidate) => candidate.key === groupKey);
  const question = group?.questions.find((candidate) => candidate.id === questionId);
  if (!group || !question) notFound("That question");
  return { group, question };
}

/** The recommender's relationship in plain words, for the assistant's prompt. */
export const relationshipLabel = (recommender: RecommenderRow): string =>
  RELATIONSHIP_LABELS[recommender.relationship] ?? "colleague";

/** A school the recommender may mark submitted, or a 422. */
export function schoolIn(context: PortalContext, schoolCycleId: string): RecommenderSchool {
  const school = context.groups
    .flatMap((group) => group.schools)
    .find((candidate) => candidate.schoolCycleId === schoolCycleId);
  if (!school) throw new ApiError(422, "That school isn't one of the ones you were asked about.");
  return school;
}
