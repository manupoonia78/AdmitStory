import { Section, Text } from "@react-email/components";
import type { RecommenderCheckinEmailInput } from "./recommender-render";
import {
  LinkBlock,
  RecommenderEmailShell,
  SchoolList,
  formatDay,
  schoolLine,
  styles,
} from "./recommender-shell";

// The three-week and one-week check-ins (Phase 6 plan §7, decision 18). Each carries a fresh link
// (decision 9: the token rotates on every send, so an older link says it was replaced) and the
// applicant's own line when they wrote one. These only go out after the applicant has read the
// text and switched the reminder on (decision 3).

export type RecommenderCheckinEmailProps = RecommenderCheckinEmailInput;

const WHEN = { checkin_3w: "Three weeks", checkin_1w: "One week" } as const;

export function recommenderCheckinSubject(input: RecommenderCheckinEmailProps): string {
  const when = WHEN[input.kind];
  const first = input.schools[0];
  if (input.schools.length === 1 && first) return `${when} until ${first.name}'s deadline`;
  const applicant = input.applicant.firstName || input.applicant.name;
  return `${when} until ${applicant}'s next deadlines`;
}

/** Copy shared by the HTML and the plain-text part. */
export function recommenderCheckinCopy(input: RecommenderCheckinEmailProps) {
  const applicant = input.applicant.firstName || input.applicant.name;
  const heading = recommenderCheckinSubject(input);
  return {
    preview: `A short note from ${applicant}, with your link to the brief.`,
    heading,
    greeting: `Dear ${input.recommender.firstName},`,
    note: input.note?.trim() ?? "",
    standIn: `${applicant} wanted to check in before the deadline. Nothing is needed in reply unless something in the brief has changed.`,
    schoolsLabel: input.schools.length === 1 ? "The deadline" : "The deadlines",
    page: "Your page still has the brief and everything you have written there.",
    button: "Open your page",
    fallback: "If the button doesn't work, copy this link into your browser:",
    fresh: `This link is new, so any earlier one has stopped working. It lasts until ${formatDay(input.expiresAt)}.`,
    submitted: "Already submitted? Mark it on your page and these reminders stop.",
    reply: `Reply to this email to reach ${applicant} directly.`,
  };
}

export function recommenderCheckinText(input: RecommenderCheckinEmailProps): string {
  const copy = recommenderCheckinCopy(input);
  return [
    copy.heading,
    "",
    copy.greeting,
    "",
    copy.note || copy.standIn,
    "",
    ...(input.schools.length > 0
      ? [`${copy.schoolsLabel}:`, ...input.schools.map((s) => `  ${schoolLine(s)}`), ""]
      : []),
    copy.page,
    "",
    input.url,
    "",
    copy.fresh,
    copy.submitted,
    copy.reply,
    "",
  ].join("\n");
}

export function RecommenderCheckinEmail(input: RecommenderCheckinEmailProps) {
  const copy = recommenderCheckinCopy(input);
  return (
    <RecommenderEmailShell preview={copy.preview} heading={copy.heading}>
      <Text style={styles.text}>{copy.greeting}</Text>
      {copy.note ? (
        <Section style={{ margin: "0 0 16px" }}>
          <Text style={styles.quote}>{copy.note}</Text>
        </Section>
      ) : (
        <Text style={styles.text}>{copy.standIn}</Text>
      )}
      <SchoolList label={copy.schoolsLabel} schools={input.schools} />
      <Text style={styles.text}>{copy.page}</Text>
      <LinkBlock url={input.url} label={copy.button} fallback={copy.fallback} />
      <Text style={styles.small}>{copy.fresh}</Text>
      <Text style={styles.small}>{copy.submitted}</Text>
      <Text style={{ ...styles.small, margin: 0 }}>{copy.reply}</Text>
    </RecommenderEmailShell>
  );
}

RecommenderCheckinEmail.PreviewProps = {
  applicant: { name: "Asha Varma", firstName: "Asha" },
  recommender: { name: "Ravi Menon", firstName: "Ravi" },
  kind: "checkin_3w",
  schools: [{ name: "Halvorsen", deadline: "2027-01-07" }],
  note: "No rush at all — I know December is your busiest month. Shout if anything in the brief is off.",
  url: "http://localhost:3000/r/preview-token",
  expiresAt: "2027-01-21T09:00:00.000Z",
} satisfies RecommenderCheckinEmailProps;
