import "server-only";

import {
  completeAccountDeletion,
  failAccountDeletion,
  getAccountDeletion,
  getAccountIdentity,
  getDb,
  hashEmail,
  listPurchases,
  pendingAccountDeletion,
  requestAccountDeletion,
  systemContext,
} from "@admitstory/db";
import { renderAccountDeletedEmail } from "@admitstory/emails";
import { accountDeleteRequested } from "@/inngest/events";
import { raiseAdminAlert } from "@/lib/alerts";
import { sendEmail } from "@/lib/email";
import { dispatch } from "@/lib/strategy/dispatch";

// Account deletion (spec §14.4, Phase 9b decision 13). Immediate, not delayed: the request signs
// the user out everywhere and records the deletion; the job emails a confirmation and then deletes
// the users row, which every user table cascades from. usage_ledger and audit_log keep anonymised
// rows. Receipts stay with Dodo Payments (the merchant of record); backups expire within 35 days.

/** A deletion needs a session signed in within this long (decision 13). */
export const FRESH_SESSION_MS = 15 * 60_000;

export function sessionIsFresh(
  createdAt: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  if (!createdAt) return false;
  const at = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  return now - at <= FRESH_SESSION_MS;
}

/** Records the deletion, signs the user out everywhere and starts the job. Returns its id. */
export async function requestDeletion(input: {
  userId: string;
  email: string;
  reason?: string | null;
  requestedBy: "user" | "admin";
}): Promise<string> {
  const db = getDb();
  const existing = await pendingAccountDeletion(db, input.userId);
  if (existing) return existing.id;
  const purchases = await listPurchases(db, input.userId);
  const row = await requestAccountDeletion(db, input.userId, {
    emailHash: hashEmail(input.email),
    reason: input.reason ?? null,
    requestedBy: input.requestedBy,
    providerTxnIds: purchases.map((p) => p.providerTxnId),
  });
  await dispatch(accountDeleteRequested.create({ deletionId: row.id }), () =>
    runAccountDeletion(row.id),
  );
  return row.id;
}

/** The job: confirmation email first (we still know where to send it), then the delete. */
export async function runAccountDeletion(deletionId: string): Promise<"done" | "missing"> {
  const db = getDb();
  const ctx = systemContext(db, "account.delete");
  const deletion = await getAccountDeletion(db, deletionId);
  if (!deletion) return "missing";
  if (deletion.status === "done") return "done";
  try {
    const user = await getAccountIdentity(db, deletion.userId);
    if (user) {
      try {
        await sendEmail({
          to: user.email,
          ...(await renderAccountDeletedEmail()),
          tag: "account-deleted",
        });
      } catch (error) {
        // The confirmation is a courtesy: a mail failure must not keep someone's data.
        console.error(
          "[account] confirmation email failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    return await completeAccountDeletion(ctx, deletionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await failAccountDeletion(ctx, deletionId, message);
    await raiseAdminAlert({
      kind: "account_deletion_failed",
      key: `account_deletion_failed:${deletionId}`,
      severity: "critical",
      title: "An account deletion failed",
      detail: { deletionId, error: message.slice(0, 200) },
    });
    throw error;
  }
}
