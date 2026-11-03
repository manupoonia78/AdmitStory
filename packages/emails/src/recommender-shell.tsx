import { APP_NAME } from "@admitstory/shared";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// The shell every recommender email shares (Phase 6 plan §7): the same Day palette and layout as
// the magic-link email, inlined because email clients ignore CSS variables. Real text only, no
// images and no icons, so the email reads the same in a screen reader as on screen.

const COLOR = {
  paper: "#ffffff",
  mist: "#f2f4f8",
  line: "#dde2ea",
  graphite: "#1a1f2e",
  slate: "#586178",
  ink: "#1e2b6f",
} as const;

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export const styles = {
  body: { margin: 0, padding: "24px 0", backgroundColor: COLOR.mist, fontFamily: FONT },
  container: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "32px",
    backgroundColor: COLOR.paper,
    border: `1px solid ${COLOR.line}`,
    borderRadius: "10px",
  },
  brand: {
    margin: "0 0 24px",
    color: COLOR.graphite,
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 700,
  },
  heading: {
    margin: "0 0 16px",
    color: COLOR.graphite,
    fontSize: "25px",
    lineHeight: "32px",
    fontWeight: 700,
  },
  text: { margin: "0 0 16px", color: COLOR.graphite, fontSize: "16px", lineHeight: "24px" },
  quote: {
    margin: "0 0 16px",
    padding: "0 0 0 16px",
    borderLeft: `2px solid ${COLOR.line}`,
    color: COLOR.graphite,
    fontSize: "16px",
    lineHeight: "24px",
    whiteSpace: "pre-wrap" as const,
  },
  label: {
    margin: "0 0 8px",
    color: COLOR.slate,
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 700,
  },
  school: { margin: "0 0 4px", color: COLOR.graphite, fontSize: "16px", lineHeight: "24px" },
  button: {
    display: "inline-block",
    padding: "12px 20px",
    backgroundColor: COLOR.ink,
    color: COLOR.paper,
    borderRadius: "6px",
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 500,
    textDecoration: "none",
  },
  small: { margin: "0 0 8px", color: COLOR.slate, fontSize: "14px", lineHeight: "20px" },
  link: { color: COLOR.ink, textDecoration: "underline", wordBreak: "break-all" as const },
} as const;

/** "3 Mar 2027" from an ISO date or time; a date we can't read is shown as it came. */
export function formatDay(iso: string | null): string {
  if (!iso) return "a date still to be confirmed";
  const time = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(time)
    : iso;
}

/** "Halvorsen — 7 Jan 2027", the one line a school gets in an email and in its text part. */
export function schoolLine(school: { name: string; deadline: string | null }): string {
  return `${school.name} — ${school.deadline ? formatDay(school.deadline) : "deadline to be confirmed"}`;
}

export interface RecommenderEmailShellProps {
  preview: string;
  heading: string;
  children: ReactNode;
}

export function RecommenderEmailShell({ preview, heading, children }: RecommenderEmailShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{APP_NAME}</Text>
          <Heading as="h1" style={styles.heading}>
            {heading}
          </Heading>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

export function SchoolList({
  label,
  schools,
}: {
  label: string;
  schools: readonly { name: string; deadline: string | null }[];
}) {
  if (schools.length === 0) return null;
  return (
    <Section style={{ margin: "0 0 16px" }}>
      <Text style={styles.label}>{label}</Text>
      {schools.map((school) => (
        <Text key={`${school.name}-${school.deadline ?? "none"}`} style={styles.school}>
          {schoolLine(school)}
        </Text>
      ))}
    </Section>
  );
}

/** The button, with the same link spelled out underneath for clients that strip buttons. */
export function LinkBlock({
  url,
  label,
  fallback,
}: {
  url: string;
  label: string;
  fallback: string;
}) {
  return (
    <>
      <Section style={{ margin: "0 0 24px" }}>
        <Button href={url} style={styles.button}>
          {label}
        </Button>
      </Section>
      <Text style={styles.small}>{fallback}</Text>
      <Text style={{ ...styles.small, margin: "0 0 24px" }}>
        <Link href={url} style={styles.link}>
          {url}
        </Link>
      </Text>
    </>
  );
}
