import "server-only";

import { createHash } from "node:crypto";
import {
  RECOMMENDER_LINK_PLACEHOLDER,
  renderRecommenderCheckinEmail,
  renderRecommenderInviteEmail,
  type RenderedEmail,
} from "@admitstory/emails";
import { APP_NAME } from "@admitstory/shared";
import { inviteExpiry, type EmailPreview, type ReminderKind } from "@admitstory/shared/kit";
import { serverEnv } from "@/lib/env";
import { emailPeople, schoolsForEmail, type RecommenderEmailContext } from "./context";

// One rendering of each recommender email, used three ways (Phase 6 plan §7): the preview the
// applicant reads, the hash that preview is remembered by, and the email that actually goes out.
//
// The hash is sha256(subject + "\n" + text) of the rendering whose link is the placeholder
// "[your private link]", so it is the same before a token exists, after one is minted, and after
// a check-in rotates it. Anything else that changes the words — a new deadline, a new note, a
// rebuilt cover note — changes the hash, and a reminder whose hash moved is not sent until the
// applicant has read it again (decision 3).

export interface ReminderEmailInput {
  kind: ReminderKind;
  /** The applicant's own line on a check-in, or null. */
  note: string | null;
  /** The schools a check-in is about; empty means every school this recommender writes for. */
  schoolCycleIds?: readonly string[];
  /** The link, or RECOMMENDER_LINK_PLACEHOLDER for a preview. */
  url: string;
  /** When the link stops working. */
  expiresAt: Date;
}

export function previewHashOf(email: { subject: string; text: string }): string {
  return createHash("sha256").update(`${email.subject}\n${email.text}`, "utf8").digest("hex");
}

/** `${APP_URL}/r/<token>`: the only place a raw portal token is ever written. */
export function portalUrl(rawToken: string): string {
  return new URL(`/r/${rawToken}`, serverEnv().APP_URL).toString();
}

/**
 * When the link in this email stops working. A check-in keeps the live invite's expiry, because
 * rotating its token does not move it; an invitation is 14 days past the latest deadline, bounded
 * by 14 and 180 days from issue, or 30 days with no deadline at all (decision 10).
 */
export function linkExpiry(
  context: RecommenderEmailContext,
  kind: ReminderKind,
  issuedAt: Date,
): Date {
  if (kind !== "ask" && context.invite) return context.invite.expiresAt;
  return inviteExpiry(issuedAt, context.deadlines);
}

/**
 * When an invitation counts as issued, for the expiry line: its scheduled moment while that is
 * still ahead, otherwise now. The expiry is written as a day, and two instants on the same day
 * give the same day, so the preview the applicant read and the email that goes out agree.
 */
export function askIssuedAt(sendAt: Date | null, now: Date): Date {
  return sendAt && sendAt.getTime() > now.getTime() ? sendAt : now;
}

export async function renderReminderEmail(
  context: RecommenderEmailContext,
  input: ReminderEmailInput,
): Promise<RenderedEmail> {
  const people = emailPeople(context);
  const expiresAt = input.expiresAt.toISOString();
  if (input.kind === "ask")
    return renderRecommenderInviteEmail({
      ...people,
      coverNote: context.coverNote,
      schools: schoolsForEmail(context),
      url: input.url,
      expiresAt,
    });
  return renderRecommenderCheckinEmail({
    ...people,
    kind: input.kind,
    schools: schoolsForEmail(context, input.schoolCycleIds),
    note: input.note,
    url: input.url,
    expiresAt,
  });
}

/** The From display name (decision 3): the address stays EMAIL_FROM's, only the name changes. */
export function fromNameFor(context: RecommenderEmailContext): string {
  return `${context.identity.name} via ${APP_NAME}`;
}

/** What the applicant reads before switching a reminder on: the text with the link stood in for. */
export async function emailPreviewFor(
  context: RecommenderEmailContext,
  input: Omit<ReminderEmailInput, "url">,
): Promise<EmailPreview> {
  const rendered = await renderReminderEmail(context, {
    ...input,
    url: RECOMMENDER_LINK_PLACEHOLDER,
  });
  return {
    to: context.recommender.email,
    replyTo: context.identity.email,
    subject: rendered.subject,
    text: rendered.text,
    previewHash: previewHashOf(rendered),
  };
}
