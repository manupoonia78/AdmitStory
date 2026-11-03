// Auth settings shared by the server config (lib/auth.ts) and the sign-in UI.

/** Sign-in links are short-lived and single-use (spec §5.1, §12.4). */
export const MAGIC_LINK_MINUTES = 10;

/** Better Auth's built-in limiter on the email-sending route; Upstash takes over in Phase 9. */
export const MAGIC_LINK_RATE_LIMIT = { window: 60, max: 5 } as const;

/** The only route the captcha plugin guards: the one that sends email to any address. */
export const CAPTCHA_ENDPOINTS = ["/sign-in/magic-link"];

/** Turnstile action set on the sign-in widget and required by the server on real hosts. */
export const TURNSTILE_ACTION = "magic-link";

/** Header Better Auth's captcha plugin reads the Turnstile token from. */
export const CAPTCHA_HEADER = "x-captcha-response";

/** Where each sign-in method lands. New accounts go to the first-run gate. */
export const SIGN_IN_REDIRECTS = {
  callbackURL: "/home",
  newUserCallbackURL: "/welcome",
  errorCallbackURL: "/sign-in",
} as const;
