import "server-only";

import {
  disableReminder,
  enableReminder,
  listReminders,
  previewReminder,
  setReminderNote,
  syncPlannedReminders,
  type DbExecutor,
  type ReminderRow,
} from "@admitstory/db";
import {
  planReminders,
  sendAtFor,
  type EmailPreview,
  type ReminderView,
} from "@admitstory/shared/kit";
import { reminderContext, type RecommenderEmailContext } from "./context";
import { askIssuedAt, emailPreviewFor, linkExpiry } from "./preview";

// The reminder schedule the applicant reads and switches on (Phase 6 decisions 3 and 18): the
// invitation, then a three-week and a one-week check-in before each deadline. Every row starts
// off. Nothing is sent until the applicant has read that exact text, which is why every view
// carries the text and its hash, and why a row whose hash has moved reads as "changed".

export interface ReminderPatch {
  /** The hash of the text the applicant has just read. */
  previewed?: string;
  on?: boolean;
  previewHash?: string;
  note?: string | null;
}

export type ReminderPatchOutcome =
  { ok: true; view: ReminderView } | { ok: false; reason: "not_found" | "stale" | "locked" };

/** The reminder's own preview: the text that would go out if it went out today. */
export async function previewForRow(
  context: RecommenderEmailContext,
  row: ReminderRow,
  now: Date,
): Promise<EmailPreview> {
  const issuedAt = row.kind === "ask" ? askIssuedAt(row.sendAt, now) : now;
  return emailPreviewFor(context, {
    kind: row.kind,
    note: row.note,
    schoolCycleIds: row.schoolCycleIds,
    expiresAt: linkExpiry(context, row.kind, issuedAt),
  });
}

function viewOf(
  context: RecommenderEmailContext,
  row: ReminderRow,
  preview: EmailPreview,
): ReminderView {
  const previewed = row.previewHash !== null && row.previewHash === preview.previewHash;
  const live = row.status === "sending" ? "on" : row.status;
  // An "on" reminder whose words have moved since it was read is not sent: say so plainly.
  const state = live === "on" && !previewed ? "changed" : live;
  const names = new Map(context.schools.map((s) => [s.schoolCycleId, s.name]));
  return {
    id: row.id,
    kind: row.kind,
    sendOn: row.sendOn,
    deadline: row.deadline,
    schools: row.schoolCycleIds.map((id) => names.get(id) ?? "A school you've since removed"),
    state,
    preview,
    note: row.note,
    previewed,
    sentAt: row.sentAt?.toISOString() ?? null,
    skippedReason: row.skippedReason,
  };
}

/** Brings the stored schedule in line with the deadlines, then renders every row. */
export async function loadReminderViews(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<ReminderView[] | null> {
  const context = await reminderContext(db, userId, recommenderId, now);
  if (!context) return null;
  const planned = planReminders({
    today: now.toISOString().slice(0, 10),
    deadlines: context.schools
      .filter((school) => school.deadline)
      .map((school) => ({ schoolCycleId: school.schoolCycleId, date: school.deadline as string })),
  }).map((plan) => ({ ...plan, sendAt: sendAtFor(plan.sendOn, context.identity.timeZone) }));
  const rows = await syncPlannedReminders(db, userId, recommenderId, planned);
  return Promise.all(
    rows.map(async (row) => viewOf(context, row, await previewForRow(context, row, now))),
  );
}

/** "Read it", "turn it on", "turn it off" and the applicant's own line, in that order. */
export async function patchReminder(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  reminderId: string,
  patch: ReminderPatch,
  now: Date = new Date(),
): Promise<ReminderPatchOutcome> {
  const context = await reminderContext(db, userId, recommenderId, now);
  if (!context) return { ok: false, reason: "not_found" };
  const find = async () =>
    (await listReminders(db, userId, recommenderId)).find((r) => r.id === reminderId) ?? null;
  let row = await find();
  if (!row) return { ok: false, reason: "not_found" };

  if (patch.note !== undefined) {
    // The note is part of the words, so writing one clears the read and needs a fresh one.
    if (!(await setReminderNote(db, userId, reminderId, patch.note)))
      return { ok: false, reason: "locked" };
    row = (await find()) ?? row;
  }

  let preview = await previewForRow(context, row, now);
  if (patch.previewed !== undefined) {
    if (patch.previewed !== preview.previewHash) return { ok: false, reason: "stale" };
    if (!(await previewReminder(db, userId, reminderId, preview.previewHash, now)))
      return { ok: false, reason: "locked" };
    row = (await find()) ?? row;
  }

  if (patch.on === true) {
    const hash = patch.previewHash ?? patch.previewed;
    if (!hash || hash !== preview.previewHash) return { ok: false, reason: "stale" };
    if (row.previewHash !== hash && !(await previewReminder(db, userId, reminderId, hash, now)))
      return { ok: false, reason: "locked" };
    const result = await enableReminder(db, userId, reminderId, hash, now);
    if (result === null) return { ok: false, reason: "not_found" };
    if (result === "stale") return { ok: false, reason: "stale" };
    row = (await find()) ?? row;
  } else if (patch.on === false) {
    if (!(await disableReminder(db, userId, reminderId))) return { ok: false, reason: "locked" };
    row = (await find()) ?? row;
  }

  preview = await previewForRow(context, row, now);
  return { ok: true, view: viewOf(context, row, preview) };
}
