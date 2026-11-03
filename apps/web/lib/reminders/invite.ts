import "server-only";

import {
  disableReminder,
  enableReminder,
  hashEmail,
  issueInvite,
  listReminders,
  newPortalToken,
  previewReminder,
  revokeInvite,
  type DbExecutor,
  type ReminderRow,
} from "@admitstory/db";
import type { InviteView } from "@admitstory/shared/kit";
import { reminderContext, type RecommenderEmailContext } from "./context";
import { deliverRecommenderEmail } from "./deliver";
import {
  askIssuedAt,
  emailPreviewFor,
  linkExpiry,
  portalUrl,
  renderReminderEmail,
} from "./preview";

// The portal link: issuing it, sending it, scheduling it and turning it off (Phase 6 plan §6).
//
// The link never comes back to the applicant (decision 7): these functions return status and the
// preview text with "[your private link]" where the link goes. The raw token exists for the few
// lines between newPortalToken() and sendEmail(), and only its sha256 is stored (§14.6).

export type InviteFailure =
  | "not_found"
  /** The preview the applicant read is no longer the text that would go out. */
  | "stale"
  | "no_brief"
  | "no_schools"
  | "no_invite"
  | "not_scheduled";

export type InviteOutcome = { ok: true; view: InviteView } | { ok: false; reason: InviteFailure };

function askReminderOf(reminders: readonly ReminderRow[]): ReminderRow | null {
  return reminders.find((row) => row.kind === "ask") ?? null;
}

/** The invite tab's view, built from a context the caller already has. */
export async function inviteViewFor(
  db: DbExecutor,
  context: RecommenderEmailContext,
  now: Date = new Date(),
): Promise<InviteView> {
  const reminders = await listReminders(db, context.recommender.userId, context.recommender.id);
  const ask = askReminderOf(reminders);
  const issuedAt = askIssuedAt(ask?.sendAt ?? null, now);
  const preview = await emailPreviewFor(context, {
    kind: "ask",
    note: null,
    expiresAt: linkExpiry(context, "ask", issuedAt),
  });
  const status = context.invite?.status ?? "none";
  const blockedReason = !context.hasReadyBrief
    ? "Build this recommender's brief first, so the invitation arrives with it."
    : context.schools.length === 0
      ? "Tell us which schools this recommender writes for."
      : status === "active"
        ? "A link is already live. Send a fresh one if they've mislaid it."
        : null;
  return {
    status,
    sentAt: context.invite?.sentAt.toISOString() ?? null,
    expiresAt: context.invite?.expiresAt.toISOString() ?? null,
    lastOpenedAt: context.invite?.lastOpenedAt?.toISOString() ?? null,
    preview,
    canSend: blockedReason === null,
    blockedReason,
    scheduled: ask && ask.status === "on" ? { sendOn: ask.sendOn } : null,
  };
}

/** GET /api/recommenders/:id/invite. Null when the recommender isn't the caller's. */
export async function loadInviteView(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<InviteView | null> {
  const context = await reminderContext(db, userId, recommenderId, now);
  return context ? inviteViewFor(db, context, now) : null;
}

/** Mints a link, records the invite (revoking any live one) and emails it to the recommender. */
async function issueAndSend(
  db: DbExecutor,
  context: RecommenderEmailContext,
  now: Date,
): Promise<boolean> {
  const userId = context.recommender.userId;
  const issuedAt = now;
  const expiresAt = linkExpiry(context, "ask", issuedAt);
  const token = newPortalToken();
  const invite = await issueInvite(db, userId, context.recommender.id, {
    tokenHash: token.hash,
    emailHash: hashEmail(context.recommender.email),
    expiresAt,
    now,
  });
  if (!invite) return false;
  const rendered = await renderReminderEmail(context, {
    kind: "ask",
    note: null,
    url: portalUrl(token.raw),
    expiresAt,
  });
  await deliverRecommenderEmail(context, rendered, "recommender-invite");
  return true;
}

/** The invitation itself, sent now. 409 on a stale preview hash; 422 without a ready brief. */
export async function sendInvite(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  previewHash: string,
  now: Date = new Date(),
): Promise<InviteOutcome> {
  const context = await reminderContext(db, userId, recommenderId, now);
  if (!context) return { ok: false, reason: "not_found" };
  if (!context.hasReadyBrief) return { ok: false, reason: "no_brief" };
  if (context.schools.length === 0) return { ok: false, reason: "no_schools" };
  const reminders = await listReminders(db, userId, recommenderId);
  const ask = askReminderOf(reminders);
  const fresh = await emailPreviewFor(context, {
    kind: "ask",
    note: null,
    expiresAt: linkExpiry(context, "ask", askIssuedAt(ask?.sendAt ?? null, now)),
  });
  if (fresh.previewHash !== previewHash) return { ok: false, reason: "stale" };
  if (!(await issueAndSend(db, context, now))) return { ok: false, reason: "not_found" };
  // The invitation has gone out, so the scheduled one must not follow it.
  if (ask) await disableReminder(db, userId, ask.id);
  const after = await reminderContext(db, userId, recommenderId, now);
  return after
    ? { ok: true, view: await inviteViewFor(db, after, now) }
    : { ok: false, reason: "not_found" };
}

/** Switches the scheduled invitation on, so the cron sends it on its day (decision 18). */
export async function scheduleInvite(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  previewHash: string,
  now: Date = new Date(),
): Promise<InviteOutcome> {
  const context = await reminderContext(db, userId, recommenderId, now);
  if (!context) return { ok: false, reason: "not_found" };
  if (!context.hasReadyBrief) return { ok: false, reason: "no_brief" };
  const ask = askReminderOf(await listReminders(db, userId, recommenderId));
  if (!ask) return { ok: false, reason: "not_scheduled" };
  const fresh = await emailPreviewFor(context, {
    kind: "ask",
    note: null,
    expiresAt: linkExpiry(context, "ask", askIssuedAt(ask.sendAt, now)),
  });
  if (fresh.previewHash !== previewHash) return { ok: false, reason: "stale" };
  await previewReminder(db, userId, ask.id, fresh.previewHash, now);
  if ((await enableReminder(db, userId, ask.id, fresh.previewHash, now)) !== "ok")
    return { ok: false, reason: "stale" };
  return { ok: true, view: await inviteViewFor(db, context, now) };
}

/** A fresh link to the same address: the old one stops working, their workspace is kept. */
export async function reissueInvite(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<InviteOutcome> {
  const context = await reminderContext(db, userId, recommenderId, now);
  if (!context) return { ok: false, reason: "not_found" };
  if (!context.invite) return { ok: false, reason: "no_invite" };
  if (!context.hasReadyBrief) return { ok: false, reason: "no_brief" };
  if (!(await issueAndSend(db, context, now))) return { ok: false, reason: "not_found" };
  const after = await reminderContext(db, userId, recommenderId, now);
  return after
    ? { ok: true, view: await inviteViewFor(db, after, now) }
    : { ok: false, reason: "not_found" };
}

/** "Turn off the link": the portal closes for the recommender; their notes are left alone. */
export async function revokeInviteFor(
  db: DbExecutor,
  userId: string,
  recommenderId: string,
  now: Date = new Date(),
): Promise<InviteOutcome> {
  const context = await reminderContext(db, userId, recommenderId, now);
  if (!context) return { ok: false, reason: "not_found" };
  await revokeInvite(db, userId, recommenderId, now);
  const after = await reminderContext(db, userId, recommenderId, now);
  return after
    ? { ok: true, view: await inviteViewFor(db, after, now) }
    : { ok: false, reason: "not_found" };
}
