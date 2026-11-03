import "server-only";

import {
  findInviteForResend,
  getDb,
  getInviteStatus,
  getRecommender,
  hashEmail,
  newPortalToken,
  rotatePortalToken,
} from "@admitstory/db";
import { renderRecommenderLinkEmail } from "@admitstory/emails";
import { APP_NAME } from "@admitstory/shared";
import { RESEND_ANSWER } from "@admitstory/ui";
import { sendEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { applicantIdentity } from "@/lib/recommenders/schools";

// "Send me a fresh link" (Phase 6 plan §6 `POST /api/r/resend`, decision 9).
//
// The answer is the same sentence whatever happens: an address with no invitation, an expired one,
// a revoked one and a live one are indistinguishable, so the form can never be used to find out
// who was asked for a recommendation. The email goes to the stored invited address only, never to
// the address in the request body, and the token rotates, so the previous link then reads
// "replaced by a newer one".

/** The one body the route ever returns. */
export const RESEND_BODY = { ok: true, message: RESEND_ANSWER } as const;

/** The link a portal token opens. */
export const portalUrl = (rawToken: string): string =>
  new URL(`/r/${rawToken}`, serverEnv().APP_URL).toString();

/**
 * Emails a fresh link if, and only if, that address has a live invitation. Never throws: the route
 * answers the same either way, and a failure here is logged without the address.
 */
export async function sendFreshLink(email: string): Promise<"sent" | "none" | "failed"> {
  const db = getDb();
  const emailHash = hashEmail(email);
  try {
    const invite = await findInviteForResend(db, emailHash);
    if (!invite) return "none";

    const [recommender, applicant, status] = await Promise.all([
      getRecommender(db, invite.userId, invite.recommenderId),
      applicantIdentity(db, invite.userId),
      getInviteStatus(db, invite.userId, invite.recommenderId),
    ]);
    // The address on the recommender must still be the invited one: a changed address revokes the
    // link (decision 8), so a mismatch means this invitation is no longer the one to resend.
    if (!recommender || hashEmail(recommender.email) !== emailHash) return "none";
    const expiresAt = status?.expiresAt?.toISOString() ?? null;
    if (!expiresAt) return "none";

    const token = newPortalToken();
    if (!(await rotatePortalToken(db, invite.inviteId, token.hash))) return "none";

    const first = recommender.name.split(/\s+/)[0] ?? recommender.name;
    const rendered = await renderRecommenderLinkEmail({
      applicant: { name: applicant.name, firstName: applicant.firstName },
      recommender: { name: recommender.name, firstName: first },
      url: portalUrl(token.raw),
      expiresAt,
    });
    await sendEmail({
      to: recommender.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tag: "recommender-link",
      replyTo: applicant.email || undefined,
      fromName: `${applicant.name} via ${APP_NAME}`,
    });
    return "sent";
  } catch (error) {
    // Never log the address or the link.
    console.error("[portal] fresh link failed", error instanceof Error ? error.message : error);
    return "failed";
  }
}
