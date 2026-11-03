import { APP_NAME } from "@admitstory/shared";
import { render } from "@react-email/render";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { createElement } from "react";
import type { RenderedEmail } from "./render";

// Phase 9b emails: the confirmation an applicant gets when their account is deleted, and the alert
// an admin gets when something needs a look. Same light palette as the sign-in email.

const COLOR = {
  paper: "#ffffff",
  mist: "#f2f4f8",
  line: "#dde2ea",
  graphite: "#1a1f2e",
  slate: "#586178",
  ink: "#1e2b6f",
} as const;

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const styles = {
  body: { margin: 0, padding: "24px 0", backgroundColor: COLOR.mist, fontFamily: FONT },
  container: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "32px",
    backgroundColor: COLOR.paper,
    border: `1px solid ${COLOR.line}`,
    borderRadius: "10px",
  },
  brand: { margin: "0 0 24px", fontSize: "16px", lineHeight: "24px", fontWeight: 700 },
  heading: {
    margin: "0 0 16px",
    color: COLOR.graphite,
    fontSize: "22px",
    lineHeight: "30px",
    fontWeight: 700,
  },
  text: { margin: "0 0 16px", color: COLOR.graphite, fontSize: "16px", lineHeight: "24px" },
  small: { margin: "0 0 8px", color: COLOR.slate, fontSize: "14px", lineHeight: "20px" },
  mono: {
    margin: "0 0 4px",
    color: COLOR.slate,
    fontSize: "13px",
    lineHeight: "20px",
    fontFamily: "Menlo, Consolas, monospace",
  },
  link: { color: COLOR.ink, textDecoration: "underline" },
} as const;

/* Account deleted ----------------------------------------------------------------------------- */

export function accountDeletedSubject(): string {
  return `Your ${APP_NAME} account has been deleted`;
}

export function accountDeletedCopy() {
  return {
    preview: `Everything you told ${APP_NAME} is being deleted now.`,
    heading: "Your account has been deleted",
    lines: [
      `We're deleting everything you wrote and said in ${APP_NAME}: your stories, drafts, kits and your recommenders' links. It should all be gone within the hour.`,
      "Backups expire within 35 days. Receipts stay with Paddle, our payment provider, as the law requires.",
      "You don't need to do anything. If you didn't ask for this, reply to this email straight away.",
    ],
    signoff: "Thank you for telling your story with us.",
  };
}

export function AccountDeletedEmail() {
  const copy = accountDeletedCopy();
  return (
    <Html lang="en">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={{ ...styles.brand, color: COLOR.ink }}>{APP_NAME}</Text>
          <Heading as="h1" style={styles.heading}>
            {copy.heading}
          </Heading>
          {copy.lines.map((line) => (
            <Text key={line} style={styles.text}>
              {line}
            </Text>
          ))}
          <Text style={styles.small}>{copy.signoff}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderAccountDeletedEmail(): Promise<RenderedEmail> {
  const copy = accountDeletedCopy();
  const html = await render(createElement(AccountDeletedEmail));
  const text = [
    copy.heading,
    "",
    ...copy.lines.flatMap((line) => [line, ""]),
    copy.signoff,
    "",
  ].join("\n");
  return { subject: accountDeletedSubject(), html, text };
}

/* Admin alert --------------------------------------------------------------------------------- */

export interface AdminAlertEmailInput {
  title: string;
  severity: "info" | "warn" | "critical";
  /** Ids and numbers only: never applicant text. */
  detail: Record<string, unknown>;
  /** The console link, e.g. https://admitstory.com/admin. */
  consoleUrl: string;
  count: number;
}

function detailLines(detail: Record<string, unknown>): string[] {
  return Object.entries(detail)
    .slice(0, 12)
    .map(([key, value]) =>
      `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`.slice(0, 200),
    );
}

export function AdminAlertEmail(input: AdminAlertEmailInput) {
  const lines = detailLines(input.detail);
  return (
    <Html lang="en">
      <Head />
      <Preview>{input.title}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={{ ...styles.brand, color: COLOR.ink }}>{APP_NAME} admin</Text>
          <Heading as="h1" style={styles.heading}>
            {input.title}
          </Heading>
          <Text style={styles.small}>
            Severity: {input.severity}
            {input.count > 1 ? ` · seen ${input.count} times` : ""}
          </Text>
          {lines.length > 0 ? (
            <Section style={{ margin: "16px 0" }}>
              {lines.map((line) => (
                <Text key={line} style={styles.mono}>
                  {line}
                </Text>
              ))}
            </Section>
          ) : null}
          <Text style={styles.text}>
            <Link href={input.consoleUrl} style={styles.link}>
              Open the admin console
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderAdminAlertEmail(input: AdminAlertEmailInput): Promise<RenderedEmail> {
  const html = await render(createElement(AdminAlertEmail, input));
  const text = [
    input.title,
    `Severity: ${input.severity}${input.count > 1 ? `, seen ${input.count} times` : ""}`,
    "",
    ...detailLines(input.detail),
    "",
    `Open the admin console: ${input.consoleUrl}`,
    "",
  ].join("\n");
  return { subject: `[${APP_NAME}] ${input.title}`, html, text };
}
