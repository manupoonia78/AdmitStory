import "server-only";

import { listRecommenderStatuses, listRecommenders, type DbExecutor } from "@admitstory/db";
import {
  planReminders,
  recommenderStatusOf,
  type RecommenderStatus,
  type RecommenderSummary,
} from "@admitstory/shared/kit";
import { shortDate } from "@/lib/strategy/pack";
import { recommenderSchools } from "./schools";

// Home's recommender lines (plan §8 entry points): one line per school ("Recommenders: 1 of 2
// invited") and the next step when an ask date is close and no invite has gone. Status only: what
// a recommender wrote never reaches the applicant (§14.3).

/** How near an ask date has to be before Home mentions it. */
const ASK_SOON_DAYS = 7;
const DAY_MS = 86_400_000;

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const RANK: Record<RecommenderStatus, number> = {
  not_invited: 0,
  invited: 1,
  opened: 2,
  in_progress: 3,
  submitted: 4,
};

/** Home's recommender lines per school and the next step (plan §8 entry points). */
export async function recommenderSummary(
  db: DbExecutor,
  userId: string,
): Promise<RecommenderSummary> {
  const [schools, people, statuses] = await Promise.all([
    recommenderSchools(db, userId),
    listRecommenders(db, userId),
    listRecommenderStatuses(db, userId),
  ]);
  const cycleOf = new Map(schools.map((s) => [s.userSchoolId, s.schoolCycleId]));
  const deadlineOf = new Map(schools.map((s) => [s.userSchoolId, s.deadline]));
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const rows = people.map((person) => {
    const status = statuses.find((s) => s.recommenderId === person.id);
    const schoolCycleIds = person.userSchoolIds.flatMap((id) => {
      const cycle = cycleOf.get(id);
      return cycle ? [cycle] : [];
    });
    const submitted: Record<string, string> = {};
    for (const [cycle, at] of Object.entries(status?.submitted ?? {})) submitted[cycle] = at;
    const state = recommenderStatusOf({
      invite: status?.invite
        ? { status: status.invite.status, sentAt: status.invite.sentAt.toISOString() }
        : null,
      openedAt: status?.openedAt?.toISOString() ?? null,
      progressAt: status?.progressAt?.toISOString() ?? null,
      submitted,
      schoolCycleIds,
    });
    const askBy =
      planReminders({
        today: todayIso,
        deadlines: person.userSchoolIds.flatMap((id) => {
          const cycle = cycleOf.get(id);
          const date = deadlineOf.get(id);
          return cycle && date ? [{ schoolCycleId: cycle, date }] : [];
        }),
      }).find((p) => p.kind === "ask")?.sendOn ?? null;
    return { person, state, submitted, askBy };
  });

  const summarySchools: RecommenderSummary["schools"] = schools.map((school) => {
    const mine = rows.filter((r) => r.person.userSchoolIds.includes(school.userSchoolId));
    const named = mine.length;
    const atLeast = (status: RecommenderStatus) =>
      mine.filter((r) => RANK[r.state] >= RANK[status]).length;
    const submitted = mine.filter((r) => Boolean(r.submitted[school.schoolCycleId])).length;
    const target = school.needed ?? named;
    let label: string;
    if (named === 0)
      label = school.needed
        ? `Recommenders: none of ${school.needed} added`
        : "Recommenders: none added";
    else if (submitted > 0 && submitted === target)
      label = `Recommenders: ${submitted} of ${target} submitted`;
    else label = `Recommenders: ${atLeast("invited")} of ${target} invited`;
    return {
      userSchoolId: school.userSchoolId,
      needed: school.needed,
      named,
      invited: atLeast("invited"),
      opened: atLeast("opened"),
      started: atLeast("in_progress"),
      submitted,
      label,
    };
  });

  const soon = rows
    .filter(
      (r) =>
        r.state === "not_invited" &&
        r.askBy !== null &&
        Date.parse(`${r.askBy}T00:00:00Z`) - today.getTime() <= ASK_SOON_DAYS * DAY_MS,
    )
    .sort((a, b) => (a.askBy ?? "").localeCompare(b.askBy ?? ""));
  const [next] = soon;
  return {
    schools: summarySchools,
    next: next?.askBy
      ? {
          text: `Ask ${firstNameOf(next.person.name)} for a recommendation by ${shortDate(next.askBy)}`,
          href: `/recommenders/${next.person.id}?tab=status`,
          due: next.askBy,
        }
      : rows.length === 0 && schools.length > 0
        ? {
            text: "Add the two people who know your work best",
            href: "/recommenders",
            due: null,
          }
        : null,
    recommenders: rows.map((r) => ({
      id: r.person.id,
      name: r.person.name,
      status: r.state,
      askBy: r.askBy,
    })),
  };
}
