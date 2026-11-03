import "server-only";

import {
  claimDueReminders,
  finishReminder,
  getDb,
  hashEmail,
  issueInvite,
  newPortalToken,
  rotateInviteToken,
  systemContext,
  type DbExecutor,
  type ReminderClaim,
} from "@admitstory/db";
import { reminderContext } from "./context";
import { deliverRecommenderEmail } from "./deliver";
import { askIssuedAt, linkExpiry, portalUrl, renderReminderEmail } from "./preview";
import { previewForRow } from "./schedule";

// The due-send loop behind the hourly cron and POST /api/dev/reminders (Phase 6 plan §7).
//
// Claim then send: claimDueReminders moves each due row to "sending" in one statement, so two runs
// never pick up the same reminder and nobody is emailed twice. Every claim then ends in exactly
// one finishReminder — sent, skipped or changed — including when the send throws.

const JOB = "inngest:notify.recommender-reminders";
const DEFAULT_LIMIT = 50;

export interface ReminderRunResult {
  sent: number;
  /** Reminders that no longer applied, plus the ones whose words had changed. */
  skipped: number;
  changed: number;
}

type Attempt =
  | { status: "sent"; deliveryId: string }
  | { status: "skipped"; reason: string }
  | { status: "changed" };

const skip = (reason: string): Attempt => ({ status: "skipped", reason });

async function attempt(db: DbExecutor, claim: ReminderClaim, now: Date): Promise<Attempt> {
  const context = await reminderContext(db, claim.userId, claim.recommenderId, now);
  if (!context) return skip("That recommender is no longer on your list.");

  const live = context.invite;
  if (claim.kind === "ask") {
    if (!context.hasReadyBrief) return skip("The brief wasn't ready, so nothing was sent.");
    if (context.schools.length === 0) return skip("This recommender has no schools listed.");
    if (live?.status === "active") return skip("A link had already been sent.");
  } else {
    if (!live) return skip("No invitation had been sent, so there was nothing to follow up.");
    if (live.status === "expired") return skip("The link had already expired.");
    if (live.status !== "active") return skip("The link had been turned off.");
    const ids =
      claim.schoolCycleIds.length > 0
        ? claim.schoolCycleIds
        : context.schools.map((school) => school.schoolCycleId);
    if (ids.length > 0 && ids.every((id) => context.submitted[id]))
      return skip("Every school for that deadline was already marked submitted.");
  }

  // The applicant reads the words and switches the reminder on; anything that moved them since
  // (a new deadline, a rebuilt cover note) holds the email back until they read it again.
  const preview = await previewForRow(context, claim, now);
  if (!claim.previewHash || claim.previewHash !== preview.previewHash) return { status: "changed" };

  const token = newPortalToken();
  let expiresAt: Date;
  if (claim.kind === "ask") {
    expiresAt = linkExpiry(context, "ask", askIssuedAt(claim.sendAt, now));
    const invite = await issueInvite(db, claim.userId, claim.recommenderId, {
      tokenHash: token.hash,
      emailHash: hashEmail(context.recommender.email),
      expiresAt,
      now,
    });
    if (!invite) return skip("The invitation could not be recorded.");
  } else if (live) {
    // A check-in carries a fresh link; the previous hash is kept, so an older link says it was
    // replaced rather than simply failing (decision 9).
    expiresAt = live.expiresAt;
    const rotated = await rotateInviteToken(db, claim.userId, live.id, { tokenHash: token.hash });
    if (!rotated) return skip("The link could not be refreshed.");
  } else return skip("No invitation had been sent, so there was nothing to follow up.");

  const rendered = await renderReminderEmail(context, {
    kind: claim.kind,
    note: claim.note,
    schoolCycleIds: claim.schoolCycleIds,
    url: portalUrl(token.raw),
    expiresAt,
  });
  const deliveryId = await deliverRecommenderEmail(
    context,
    rendered,
    claim.kind === "ask" ? "recommender-invite" : "recommender-checkin",
  );
  return { status: "sent", deliveryId };
}

/** Sends every reminder that is due, switched on and still says what the applicant read. */
export async function runDueReminders(
  options: { now?: Date; limit?: number; db?: DbExecutor } = {},
): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? getDb();
  const ctx = systemContext(db, JOB);
  const claims = await claimDueReminders(ctx, now, options.limit ?? DEFAULT_LIMIT);
  const result: ReminderRunResult = { sent: 0, skipped: 0, changed: 0 };
  for (const claim of claims) {
    let outcome: Attempt;
    try {
      outcome = await attempt(db, claim, now);
    } catch (error) {
      // Never log the link or the email body; the reason is what the applicant will read.
      console.error(
        "[recommender-reminders] a reminder was not sent:",
        error instanceof Error ? error.message : "unknown error",
      );
      outcome = skip("We couldn't send it this time. It will be tried again.");
    }
    if (outcome.status === "sent") {
      await finishReminder(ctx, claim.id, { status: "sent", deliveryId: outcome.deliveryId }, now);
      result.sent += 1;
    } else if (outcome.status === "changed") {
      await finishReminder(ctx, claim.id, { status: "changed" }, now);
      result.changed += 1;
      result.skipped += 1;
    } else {
      await finishReminder(
        ctx,
        claim.id,
        { status: "skipped", skippedReason: outcome.reason },
        now,
      );
      result.skipped += 1;
    }
  }
  return result;
}
