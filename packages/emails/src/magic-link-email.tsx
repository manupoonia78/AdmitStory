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

export interface MagicLinkEmailProps {
  /** The one-time sign-in URL from Better Auth's magic-link plugin. */
  url: string;
  /** How long the link works, as configured in apps/web/lib/auth.ts. */
  expiresInMinutes: number;
}

// Light palette from packages/ui tokens (spec §6.2). Email clients ignore CSS variables, so the
// values are inlined. Every text pair meets WCAG AA: graphite on paper 16:1, slate on paper 6.3:1,
// paper on ink 12:1.
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
    fontSize: "25px",
    lineHeight: "32px",
    fontWeight: 700,
  },
  text: { margin: "0 0 16px", color: COLOR.graphite, fontSize: "16px", lineHeight: "24px" },
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

export function magicLinkSubject(): string {
  return `Your sign-in link for ${APP_NAME}`;
}

/** Copy shared by the HTML and plain-text versions, so the two never drift (spec §6.7 voice). */
export function magicLinkCopy(expiresInMinutes: number) {
  return {
    preview: `Use this link to sign in to ${APP_NAME}. It works for ${expiresInMinutes} minutes.`,
    heading: `Sign in to ${APP_NAME}`,
    intro: `Use the button below to sign in. The link works once, for the next ${expiresInMinutes} minutes.`,
    button: `Sign in to ${APP_NAME}`,
    fallback: "If the button doesn't work, copy this link into your browser:",
    ignore: "If you didn't ask to sign in, you can ignore this email.",
  };
}

export function MagicLinkEmail({ url, expiresInMinutes }: MagicLinkEmailProps) {
  const copy = magicLinkCopy(expiresInMinutes);
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{copy.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={{ ...styles.brand, color: COLOR.graphite }}>{APP_NAME}</Text>
          <Heading as="h1" style={styles.heading}>
            {copy.heading}
          </Heading>
          <Text style={styles.text}>{copy.intro}</Text>
          <Section style={{ margin: "0 0 24px" }}>
            <Button href={url} style={styles.button}>
              {copy.button}
            </Button>
          </Section>
          <Text style={styles.small}>{copy.fallback}</Text>
          <Text style={{ ...styles.small, margin: "0 0 24px" }}>
            <Link href={url} style={styles.link}>
              {url}
            </Link>
          </Text>
          <Text style={{ ...styles.small, margin: 0 }}>{copy.ignore}</Text>
        </Container>
      </Body>
    </Html>
  );
}

MagicLinkEmail.PreviewProps = {
  url: "http://localhost:3000/api/auth/magic-link/verify?token=preview-token",
  expiresInMinutes: 10,
} satisfies MagicLinkEmailProps;
