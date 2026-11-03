import "server-only";

import { getDb } from "@admitstory/db";
import {
  RECOMMENDER_STATUSES,
  recommenderStatusOf,
  type RecommenderStatus,
  type StatusView,
} from "@admitstory/shared/kit";
import { reminderContext } from "./context";
import { inviteViewFor } from "./invite";
import { loadReminderViews } from "./schedule";

// Screen H's "Status and reminders" tab (Phase 6 plan §6, §8). Status only: what the recommender
// wrote is never read here (§14.3). The timeline is the facts the applicant is allowed to see —
// invited, opened, started, marked submitted — each with the time it happened, and nothing else.

/** The step's time, or null when it hasn't happened (so the list can show it unreached). */
function timelineOf(
  status: RecommenderStatus,
  times: {
    sentAt: Date | null;
    openedAt: Date | null;
    progressAt: Date | null;
    submittedAt: string | null;
  },
): StatusView["timeline"] {
  const at: Record<RecommenderStatus, string | null> = {
    not_invited: null,
    invited: times.sentAt?.toISOString() ?? null,
    opened: times.openedAt?.toISOString() ?? null,
    in_progress: times.progressAt?.toISOString() ?? null,
    submitted: times.submittedAt,
  };
  const reached = RECOMMENDER_STATUSES.indexOf(status);
  return RECOMMENDER_STATUSES.map((step, index) => ({
    step,
    // A later step's time can be missing (a recommender who marks a school submitted without the
    // page ever recording progress); the step still counts as reached.
    at: index <= reached ? at[step] : null,
  }));
}

/** Screen H's Status and reminders tab: status, invite and reminders. Null when not the caller's. */
export async function loadStatusView(
  userId: string,
  recommenderId: string,
): Promise<StatusView | null> {
  const db = getDb();
  const now = new Date();
  const context = await reminderContext(db, userId, recommenderId, now);
  if (!context) return null;
  const [invite, reminders] = await Promise.all([
    inviteViewFor(db, context, now),
    loadReminderViews(db, userId, recommenderId, now),
  ]);
  const schoolCycleIds = context.schools.map((school) => school.schoolCycleId);
  const status = recommenderStatusOf({
    invite: context.invite
      ? { status: context.invite.status, sentAt: context.invite.sentAt.toISOString() }
      : null,
    openedAt: context.openedAt?.toISOString() ?? null,
    progressAt: context.progressAt?.toISOString() ?? null,
    submitted: context.submitted,
    schoolCycleIds,
  });
  const submitted = context.schools.map((school) => ({
    schoolCycleId: school.schoolCycleId,
    school: school.name,
    at: context.submitted[school.schoolCycleId] ?? null,
  }));
  const marked = submitted.map((row) => row.at).filter((at): at is string => at !== null);
  return {
    status,
    timeline: timelineOf(status, {
      sentAt: context.invite?.sentAt ?? null,
      openedAt: context.openedAt,
      progressAt: context.progressAt,
      submittedAt: marked.length > 0 ? (marked.sort()[marked.length - 1] ?? null) : null,
    }),
    submitted,
    invite,
    reminders: reminders ?? [],
  };
}
