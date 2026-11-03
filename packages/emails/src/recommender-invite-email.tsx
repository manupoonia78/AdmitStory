import { Section, Text } from "@react-email/components";
import type { RecommenderInviteEmailInput } from "./recommender-render";
import {
  LinkBlock,
  RecommenderEmailShell,
  SchoolList,
  formatDay,
  schoolLine,
  styles,
} from "./recommender-shell";

// The invitation (Phase 6 plan §7, decision 3): the applicant's own cover note, the schools and
// their deadlines, the private link, when it stops working, and what the applicant can and cannot
// see. The link reaches the recommender's address only; it is never shown to the applicant
// (decision 7), so this template is the single place it appears.

export type RecommenderInviteEmailProps = RecommenderInviteEmailInput;

export function recommenderInviteSubject(input: RecommenderInviteEmailProps): string {
  return `${input.applicant.name} asked you for a recommendation`;
}

/** Copy shared by the HTML and the plain-text part, so the two never drift (§6.7 voice). */
export function recommenderInviteCopy(input: RecommenderInviteEmailProps) {
  const applicant = input.applicant.firstName || input.applicant.name;
  return {
    preview: `${applicant} has written you a brief: the questions each school asks, the deadlines, and the moments they remember.`,
    heading: `${applicant} asked you for a recommendation`,
    greeting: `Dear ${input.recommender.firstName},`,
    coverNote: input.coverNote.trim(),
    schoolsLabel:
      input.schools.length === 1 ? "The school and its deadline" : "Schools and deadlines",
    brief: `Your own page has the questions each school asks, word for word, and a short brief from ${applicant}: the projects you worked on together, the numbers, and what they remember you saying and doing. Write the letter in your own words, here or anywhere you prefer.`,
    button: "Open your brief",
    fallback: "If the button doesn't work, copy this link into your browser:",
    expiry: `The link is yours alone, so please don't forward it. It stops working on ${formatDay(input.expiresAt)}.`,
    privacy: `What you write stays with you. ${applicant} can see when you open the page and when you mark a school submitted, and nothing else.`,
    reply: `Reply to this email to reach ${applicant} directly.`,
  };
}

export function recommenderInviteText(input: RecommenderInviteEmailProps): string {
  const copy = recommenderInviteCopy(input);
  const lines = [
    copy.heading,
    "",
    copy.greeting,
    "",
    ...(copy.coverNote ? [copy.coverNote, ""] : []),
    ...(input.schools.length > 0
      ? [`${copy.schoolsLabel}:`, ...input.schools.map((s) => `  ${schoolLine(s)}`), ""]
      : []),
    copy.brief,
    "",
    input.url,
    "",
    copy.expiry,
    copy.privacy,
    copy.reply,
    "",
  ];
  return lines.join("\n");
}

export function RecommenderInviteEmail(input: RecommenderInviteEmailProps) {
  const copy = recommenderInviteCopy(input);
  return (
    <RecommenderEmailShell preview={copy.preview} heading={copy.heading}>
      <Text style={styles.text}>{copy.greeting}</Text>
      {copy.coverNote ? (
        <Section style={{ margin: "0 0 16px" }}>
          <Text style={styles.quote}>{copy.coverNote}</Text>
        </Section>
      ) : null}
      <SchoolList label={copy.schoolsLabel} schools={input.schools} />
      <Text style={styles.text}>{copy.brief}</Text>
      <LinkBlock url={input.url} label={copy.button} fallback={copy.fallback} />
      <Text style={styles.small}>{copy.expiry}</Text>
      <Text style={styles.small}>{copy.privacy}</Text>
      <Text style={{ ...styles.small, margin: 0 }}>{copy.reply}</Text>
    </RecommenderEmailShell>
  );
}

RecommenderInviteEmail.PreviewProps = {
  applicant: { name: "Asha Varma", firstName: "Asha" },
  recommender: { name: "Ravi Menon", firstName: "Ravi" },
  coverNote:
    "You saw the night-shift rollout up close, and you were the one who told me to slow down and bring the ward sisters with me. That is the part of my story I most want Halvorsen to hear.",
  schools: [
    { name: "Halvorsen", deadline: "2027-01-07" },
    { name: "Marrowgate", deadline: "2027-01-14" },
  ],
  url: "http://localhost:3000/r/preview-token",
  expiresAt: "2027-01-28T09:00:00.000Z",
} satisfies RecommenderInviteEmailProps;
