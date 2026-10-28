import { MAGIC_LINK_MINUTES } from "./auth-constants";

// Sign-in copy (spec §6.7: plain, warm, direct; say what to do next; no "Oops", no exclamation
// marks). Kept here, away from the components, so the voice rules are unit-tested. No zod in
// this module: the sign-in form imports it, and zod would add ~25 KB gz to that route.

/**
 * A rough shape check before the server's real validation (Better Auth parses the address with
 * zod). It only catches typos like a missing @ or domain, so we can say what to fix.
 */
export function looksLikeEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

/** A sign-in link that is expired, already used or mangled all look the same to the server. */
const LINK_ERRORS = new Set(["INVALID_TOKEN", "EXPIRED_TOKEN", "invalid_token", "expired_token"]);

export interface Notice {
  title: string;
  body: string;
}

/** What to show for an `?error=` code from a magic link, Google or a passkey redirect. */
export function noticeForErrorCode(code: string | undefined): Notice | null {
  if (!code) return null;
  if (LINK_ERRORS.has(code)) {
    return {
      title: "That sign-in link has expired",
      body: `Links work once, for ${MAGIC_LINK_MINUTES} minutes. Enter your email and we'll send you a new one.`,
    };
  }
  if (code === "access_denied") {
    return {
      title: "Google sign-in was cancelled",
      body: "You can try Google again, or get a sign-in link by email instead.",
    };
  }
  return {
    title: "We couldn't sign you in",
    body: "Enter your email and we'll send you a new sign-in link.",
  };
}

export type SendFailure = "rate-limited" | "captcha" | "invalid-email" | "network" | "unavailable";

/** Classifies a failed POST /sign-in/magic-link by status and Better Auth error code. */
export function classifySendFailure(
  error: {
    status?: number | undefined;
    code?: string | undefined;
  } | null,
): SendFailure {
  if (!error) return "network";
  if (error.status === 429) return "rate-limited";
  const code = error.code ?? "";
  if (/CAPTCHA|VERIFICATION_FAILED|MISSING_RESPONSE/i.test(code)) return "captcha";
  if (error.status === 403) return "captcha";
  if (/EMAIL/i.test(code) || error.status === 400) return "invalid-email";
  if (error.status === 0 || error.status === undefined) return "network";
  return "unavailable";
}

export const SEND_FAILURE_MESSAGES: Record<SendFailure, string> = {
  "rate-limited": "We've sent a few links already. Wait a minute, then ask for another.",
  captcha: "The security check didn't go through. Let it finish, then send the link again.",
  "invalid-email": "Enter an email address in the format name@example.com.",
  network: "We couldn't reach the server. Check your connection, then try again.",
  unavailable: "The sign-in link wasn't sent. Try again in a moment.",
};

export const PASSKEY_FAILURE_MESSAGES = {
  cancelled: "Passkey sign-in was cancelled. You can try again, or get a link by email.",
  notFound:
    "We didn't find that passkey on an account here. Sign in with an email link, then add a passkey in Settings.",
  failed: "That passkey didn't work. Try again, or get a sign-in link by email.",
} as const;

/** Maps a failed passkey ceremony to one of the messages above. */
export function passkeyFailureMessage(
  error: {
    code?: string | undefined;
    status?: number | undefined;
  } | null,
): string {
  const code = error?.code ?? "";
  if (/CANCEL|NotAllowed|ABORT/i.test(code)) return PASSKEY_FAILURE_MESSAGES.cancelled;
  if (/NOT_FOUND/i.test(code) || error?.status === 401) return PASSKEY_FAILURE_MESSAGES.notFound;
  return PASSKEY_FAILURE_MESSAGES.failed;
}

export const SIGN_IN_COPY = {
  headline: "Sign in or create your account",
  intro: "Enter your email and we'll send you a link. No password needed.",
  emailLabel: "Email address",
  send: "Email me a sign-in link",
  sending: "Sending your link",
  captchaWaiting: "Checking that you're not a bot. This usually takes a second.",
  divider: "Or",
  google: "Continue with Google",
  googleFailed: "Google sign-in didn't start. Try again, or get a sign-in link by email.",
  passkey: "Sign in with a passkey",
  passkeyPending: "Waiting for your passkey",
  sentTitle: "Check your email",
  sentBody: (email: string) => `We sent a sign-in link to ${email}.`,
  sentHint: `The link works once, for the next ${MAGIC_LINK_MINUTES} minutes. If you can't find it, check your spam folder.`,
  resend: "Send the link again",
  resent: "We sent another link. Use the newest one.",
  changeEmail: "Use a different email",
} as const;
