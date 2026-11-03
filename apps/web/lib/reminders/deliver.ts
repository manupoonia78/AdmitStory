import "server-only";

import type { RenderedEmail } from "@admitstory/emails";
import { sendEmail } from "@/lib/email";
import { type RecommenderEmailContext } from "./context";
import { fromNameFor } from "./preview";

// Sending one recommender email (Phase 6 decision 3): the address stays EMAIL_FROM's with the
// display name "{Applicant} via AdmitStory", and Reply-To is the applicant, so a recommender who
// replies reaches the person who asked them and never us. Without RESEND_API_KEY the email lands
// in .outbox/ (docs/decisions/0002), which is how the whole flow runs locally.

export type RecommenderEmailTag = "recommender-invite" | "recommender-checkin";

/** The delivery id (a Resend message id, or the outbox file path). */
export async function deliverRecommenderEmail(
  context: RecommenderEmailContext,
  rendered: RenderedEmail,
  tag: RecommenderEmailTag,
): Promise<string> {
  const replyTo = context.identity.email.trim();
  const sent = await sendEmail({
    to: context.recommender.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tag,
    ...(replyTo ? { replyTo } : {}),
    fromName: fromNameFor(context),
  });
  return sent.id;
}
