"use client";

import type { ThemePreference } from "@admitstory/ui";
import { Button, TextField, focusFirstInvalid } from "@admitstory/ui";
import {
  EnvelopeSimpleIcon,
  FingerprintIcon,
  GoogleLogoIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { CAPTCHA_HEADER, SIGN_IN_REDIRECTS, TURNSTILE_ACTION } from "@/lib/auth-constants";
import {
  PASSKEY_FAILURE_MESSAGES,
  SEND_FAILURE_MESSAGES,
  SIGN_IN_COPY,
  classifySendFailure,
  looksLikeEmail,
  passkeyFailureMessage,
  type Notice,
} from "@/lib/sign-in-copy";
import { conditionalMediationAvailable, useWebAuthnSupport } from "@/lib/webauthn-support";

export interface SignInFormProps {
  /** Null when the server doesn't enforce Turnstile (local development without keys). */
  turnstileSiteKey: string | null;
  googleEnabled: boolean;
  /** A notice from a failed redirect (expired link, cancelled Google sign-in). */
  notice: Notice | null;
  theme: ThemePreference;
}

// The Better Auth client (and @simplewebauthn/browser with it) is only needed after the page is
// interactive, so it loads on demand instead of counting towards this route's first load.
function loadAuthClient() {
  return import("@/lib/auth-client").then((module) => module.authClient);
}

interface CaptchaProps {
  siteKey: string;
  theme: ThemePreference;
  widgetRef: React.RefObject<TurnstileInstance | null>;
  onToken: (token: string | null) => void;
  onFailure: () => void;
}

/** Cloudflare Turnstile (spec §5.1, §12.4). Its height is reserved so nothing shifts as it loads. */
function Captcha({ siteKey, theme, widgetRef, onToken, onFailure }: CaptchaProps) {
  return (
    <div className="min-h-[65px]">
      <Turnstile
        ref={widgetRef}
        siteKey={siteKey}
        options={{
          theme: theme === "system" ? "auto" : theme,
          size: "flexible",
          language: "en",
          action: TURNSTILE_ACTION,
        }}
        onSuccess={(token) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => {
          onToken(null);
          onFailure();
        }}
      />
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-sm text-slate" role="presentation">
      <span className="h-px flex-1 bg-line" />
      <span>{SIGN_IN_COPY.divider}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function SignInForm({ turnstileSiteKey, googleEnabled, notice, theme }: SignInFormProps) {
  const router = useRouter();
  const passkeysSupported = useWebAuthnSupport();
  const captchaRef = useRef<TurnstileInstance | null>(null);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [sentTo, setSentTo] = useState<string | null>(null);
  /** The address the last link went to, filled back in after "Use a different email". */
  const [lastEmail, setLastEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [status, setStatus] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string>();
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    if (sentTo) sentHeadingRef.current?.focus();
  }, [sentTo]);

  // Offer saved passkeys in the email field's autofill, where the browser supports it.
  useEffect(() => {
    let cancelled = false;
    void conditionalMediationAvailable().then(async (available) => {
      if (!available || cancelled) return;
      const authClient = await loadAuthClient();
      const result = await authClient.signIn.passkey({ autoFill: true });
      // Autofill is silent on failure: the modal flow or another method takes over.
      if (!cancelled && result && !result.error) router.replace(SIGN_IN_REDIRECTS.callbackURL);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function sendLink(email: string): Promise<boolean> {
    setFormError(undefined);
    if (turnstileSiteKey && !captchaToken) {
      setFormError(SIGN_IN_COPY.captchaWaiting);
      return false;
    }
    setSending(true);
    try {
      const authClient = await loadAuthClient();
      const { error } = await authClient.signIn.magicLink(
        { email, ...SIGN_IN_REDIRECTS },
        { headers: captchaToken ? { [CAPTCHA_HEADER]: captchaToken } : {} },
      );
      if (error) {
        setFormError(SEND_FAILURE_MESSAGES[classifySendFailure(error)]);
        return false;
      }
      return true;
    } catch {
      setFormError(SEND_FAILURE_MESSAGES.network);
      return false;
    } finally {
      setSending(false);
      // Each Turnstile token is single-use, so get a fresh one for the next request.
      setCaptchaToken(null);
      captchaRef.current?.reset();
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = String(new FormData(form).get("email") ?? "").trim();
    if (!looksLikeEmail(raw)) {
      // Render the error, then focus the field so its label, "invalid" and the error are read.
      flushSync(() => setEmailError(SEND_FAILURE_MESSAGES["invalid-email"]));
      focusFirstInvalid(form);
      return;
    }
    setEmailError(undefined);
    if (await sendLink(raw)) {
      setStatus("");
      setLastEmail(raw);
      setSentTo(raw);
    }
  }

  async function resend() {
    if (!sentTo) return;
    setStatus("");
    if (await sendLink(sentTo)) setStatus(SIGN_IN_COPY.resent);
  }

  async function signInWithPasskey() {
    setPasskeyError(undefined);
    setPasskeyPending(true);
    try {
      const authClient = await loadAuthClient();
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        setPasskeyError(passkeyFailureMessage(result.error));
        return;
      }
      router.replace(SIGN_IN_REDIRECTS.callbackURL);
    } catch {
      setPasskeyError(PASSKEY_FAILURE_MESSAGES.failed);
    } finally {
      setPasskeyPending(false);
    }
  }

  async function signInWithGoogle() {
    setGooglePending(true);
    try {
      const authClient = await loadAuthClient();
      // Better Auth answers with Google's URL and the client navigates there.
      const { error } = await authClient.signIn.social({
        provider: "google",
        ...SIGN_IN_REDIRECTS,
      });
      if (error) {
        setFormError(SIGN_IN_COPY.googleFailed);
        setGooglePending(false);
      }
    } catch {
      setFormError(SEND_FAILURE_MESSAGES.network);
      setGooglePending(false);
    }
  }

  const captcha = turnstileSiteKey ? (
    <Captcha
      siteKey={turnstileSiteKey}
      theme={theme}
      widgetRef={captchaRef}
      onToken={setCaptchaToken}
      onFailure={() => setFormError(SEND_FAILURE_MESSAGES.captcha)}
    />
  ) : null;

  if (sentTo) {
    return (
      <section aria-labelledby="sent-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2
            id="sent-heading"
            ref={sentHeadingRef}
            tabIndex={-1}
            className="text-xl font-bold text-graphite outline-none"
          >
            {SIGN_IN_COPY.sentTitle}
          </h2>
          <p>
            We sent a sign-in link to <span className="font-medium break-all">{sentTo}</span>.
          </p>
          <p className="text-slate">{SIGN_IN_COPY.sentHint}</p>
        </div>
        {captcha}
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={sending} onClick={resend}>
              {sending ? SIGN_IN_COPY.sending : SIGN_IN_COPY.resend}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                // Back to the form with the address filled in, and focus on it to change it.
                flushSync(() => {
                  setSentTo(null);
                  setStatus("");
                  setFormError(undefined);
                });
                emailRef.current?.focus();
              }}
            >
              {SIGN_IN_COPY.changeEmail}
            </Button>
          </div>
          <StatusMessage message={status} className="not-empty:mt-4" />
          <AlertMessage message={formError} className="not-empty:mt-4" />
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <div className="flex gap-3 rounded-panel border border-slate bg-mist p-4">
          <InfoIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-ink" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-graphite">{notice.title}</p>
            <p className="text-graphite">{notice.body}</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={submitEmail} noValidate className="flex flex-col gap-4">
        <TextField
          ref={emailRef}
          label={SIGN_IN_COPY.emailLabel}
          name="email"
          defaultValue={lastEmail}
          type="email"
          inputMode="email"
          // "webauthn" lets the browser offer saved passkeys here (conditional mediation).
          autoComplete="email webauthn"
          autoCapitalize="none"
          spellCheck={false}
          required
          error={emailError}
        />
        {captcha}
        <div className="flex flex-col">
          <Button type="submit" icon={EnvelopeSimpleIcon} loading={sending} className="w-full">
            {sending ? SIGN_IN_COPY.sending : SIGN_IN_COPY.send}
          </Button>
          <AlertMessage message={formError} className="not-empty:mt-4" />
        </div>
      </form>

      {googleEnabled || passkeysSupported ? (
        <>
          <Divider />
          <div className="flex flex-col gap-3">
            {googleEnabled ? (
              <Button
                variant="secondary"
                icon={GoogleLogoIcon}
                loading={googlePending}
                onClick={signInWithGoogle}
                className="w-full"
              >
                {SIGN_IN_COPY.google}
              </Button>
            ) : null}
            {passkeysSupported ? (
              <div className="flex flex-col">
                <Button
                  variant="secondary"
                  icon={FingerprintIcon}
                  loading={passkeyPending}
                  onClick={signInWithPasskey}
                  className="w-full"
                >
                  {passkeyPending ? SIGN_IN_COPY.passkeyPending : SIGN_IN_COPY.passkey}
                </Button>
                <AlertMessage message={passkeyError} className="not-empty:mt-3" />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
