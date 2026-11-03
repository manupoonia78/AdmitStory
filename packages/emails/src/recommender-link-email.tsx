import { Text } from "@react-email/components";
import type { RecommenderLinkEmailInput } from "./recommender-render";
import { LinkBlock, RecommenderEmailShell, formatDay, styles } from "./recommender-shell";

// "Send me a fresh link" from the portal's closed page (Phase 6 decision 9). It goes only to the
// address already on the invite, and the answer at /r is the same whether or not an invite exists,
// so this email neither confirms nor denies anything to a stranger.

export type RecommenderLinkEmailProps = RecommenderLinkEmailInput;

export function recommenderLinkSubject(input: RecommenderLinkEmailProps): string {
  const applicant = input.applicant.firstName || input.applicant.name;
  return `Your link to ${applicant}'s recommendation brief`;
}

/** Copy shared by the HTML and the plain-text part. */
export function recommenderLinkCopy(input: RecommenderLinkEmailProps) {
  const applicant = input.applicant.firstName || input.applicant.name;
  return {
    preview: `A fresh link to your page for ${applicant}'s recommendation.`,
    heading: "Here is a fresh link",
    greeting: `Dear ${input.recommender.firstName},`,
    body: `This opens your page for ${input.applicant.name}'s recommendation, with the brief and anything you have written there.`,
    button: "Open your page",
    fallback: "If the button doesn't work, copy this link into your browser:",
    expiry: `It works until ${formatDay(input.expiresAt)}. Any earlier link has stopped working.`,
    ignore: "If you didn't ask for this, you can ignore the email and nothing changes.",
  };
}

export function recommenderLinkText(input: RecommenderLinkEmailProps): string {
  const copy = recommenderLinkCopy(input);
  return [
    copy.heading,
    "",
    copy.greeting,
    "",
    copy.body,
    "",
    input.url,
    "",
    copy.expiry,
    copy.ignore,
    "",
  ].join("\n");
}

export function RecommenderLinkEmail(input: RecommenderLinkEmailProps) {
  const copy = recommenderLinkCopy(input);
  return (
    <RecommenderEmailShell preview={copy.preview} heading={copy.heading}>
      <Text style={styles.text}>{copy.greeting}</Text>
      <Text style={styles.text}>{copy.body}</Text>
      <LinkBlock url={input.url} label={copy.button} fallback={copy.fallback} />
      <Text style={styles.small}>{copy.expiry}</Text>
      <Text style={{ ...styles.small, margin: 0 }}>{copy.ignore}</Text>
    </RecommenderEmailShell>
  );
}

RecommenderLinkEmail.PreviewProps = {
  applicant: { name: "Asha Varma", firstName: "Asha" },
  recommender: { name: "Ravi Menon", firstName: "Ravi" },
  url: "http://localhost:3000/r/preview-token",
  expiresAt: "2027-01-28T09:00:00.000Z",
} satisfies RecommenderLinkEmailProps;
