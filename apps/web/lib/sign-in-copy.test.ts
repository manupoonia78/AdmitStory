import { describe, expect, it } from "vitest";
import { PLACEHOLDERS } from "../components/placeholder-copy";
import {
  PASSKEY_FAILURE_MESSAGES,
  SEND_FAILURE_MESSAGES,
  SIGN_IN_COPY,
  classifySendFailure,
  looksLikeEmail,
  noticeForErrorCode,
  passkeyFailureMessage,
} from "./sign-in-copy";

// Spec §6.7: never "Oops", "Something went wrong", "Unleash", "Supercharge", "Journey", and no
// exclamation marks in system messages.
const BANNED = /oops|something went wrong|unleash|supercharge|journey|!/i;

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function")
    return [String((value as (s: string) => string)("x@example.test"))];
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

describe("voice rules", () => {
  const notices = ["INVALID_TOKEN", "access_denied", "unknown_error"].map(noticeForErrorCode);
  const copy = [
    SIGN_IN_COPY,
    SEND_FAILURE_MESSAGES,
    PASSKEY_FAILURE_MESSAGES,
    notices,
    PLACEHOLDERS,
  ];

  it.each(allStrings(copy))("%s", (text) => {
    expect(text).not.toMatch(BANNED);
    // Sentence case: no all-caps words beyond short acronyms.
    expect(text).not.toMatch(/\b[A-Z]{5,}\b/);
  });

  it("names the exact action on buttons", () => {
    expect(SIGN_IN_COPY.send).toBe("Email me a sign-in link");
    expect(SIGN_IN_COPY.google).toBe("Continue with Google");
    expect(SIGN_IN_COPY.passkey).toBe("Sign in with a passkey");
  });

  it("never mentions passwords except to say none are needed", () => {
    for (const text of allStrings(copy)) {
      if (/password/i.test(text)) expect(text).toMatch(/no password needed/i);
    }
  });
});

describe("noticeForErrorCode", () => {
  it("explains an expired or used link and what to do", () => {
    expect(noticeForErrorCode("INVALID_TOKEN")?.title).toBe("That sign-in link has expired");
    expect(noticeForErrorCode("INVALID_TOKEN")?.body).toMatch(/new one/);
  });

  it("has a calm fallback and nothing without a code", () => {
    expect(noticeForErrorCode("failed_to_create_session")?.title).toBe("We couldn't sign you in");
    expect(noticeForErrorCode(undefined)).toBeNull();
  });
});

describe("classifySendFailure", () => {
  it.each([
    [{ status: 429 }, "rate-limited"],
    [{ status: 400, code: "MISSING_RESPONSE" }, "captcha"],
    [{ status: 403, code: "VERIFICATION_FAILED" }, "captcha"],
    [{ status: 400, code: "INVALID_EMAIL" }, "invalid-email"],
    [{ status: 500 }, "unavailable"],
    [null, "network"],
  ] as const)("%o → %s", (error, expected) => {
    expect(classifySendFailure(error)).toBe(expected);
  });
});

describe("passkeyFailureMessage", () => {
  it("separates cancelled, unknown and failed passkeys", () => {
    expect(passkeyFailureMessage({ code: "AUTH_CANCELLED" })).toBe(
      PASSKEY_FAILURE_MESSAGES.cancelled,
    );
    expect(passkeyFailureMessage({ code: "ERROR_CEREMONY_ABORTED" })).toBe(
      PASSKEY_FAILURE_MESSAGES.cancelled,
    );
    expect(passkeyFailureMessage({ code: "PASSKEY_NOT_FOUND", status: 401 })).toBe(
      PASSKEY_FAILURE_MESSAGES.notFound,
    );
    expect(passkeyFailureMessage({ code: "AUTHENTICATION_FAILED" })).toBe(
      PASSKEY_FAILURE_MESSAGES.failed,
    );
  });
});

describe("looksLikeEmail", () => {
  it.each(["test-1@example.test", "a.b+c@sub.example.co"])("accepts %s", (value) => {
    expect(looksLikeEmail(value)).toBe(true);
  });
  it.each(["", "name", "name@", "name@example", "a b@example.test", "@example.test"])(
    "rejects %s",
    (value) => {
      expect(looksLikeEmail(value)).toBe(false);
    },
  );
});
