import { APP_NAME } from "@admitstory/shared";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthFrame } from "@/components/auth-frame";
import { PostHogIdentity } from "@/lib/analytics/posthog-client";
import { googleConfigured, serverEnv } from "@/lib/env";
import { getSession } from "@/lib/session";
import { SIGN_IN_COPY, noticeForErrorCode } from "@/lib/sign-in-copy";
import { EntrySheet } from "./entry-sheet";
import { KeptLine } from "./kept-line";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${APP_NAME} with an email link, Google or a passkey.`,
};

/**
 * `?error=` is the code Better Auth adds when it redirects back here. `?from=line` means the
 * visitor pressed "Sign up and keep this line" on our homepage (plan §5).
 */
const SearchParams = z.object({
  from: z.literal("line").optional().catch(undefined),
  error: z
    .string()
    .trim()
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional()
    .catch(undefined),
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getSession()) redirect("/home");

  const env = serverEnv();
  const { error, from } = SearchParams.parse(await searchParams);

  return (
    // The room is always Night (SPEC §5), so Turnstile is asked for its dark theme.
    <AuthFrame aside={<EntrySheet />}>
      {/* Signed out: forget any identity from before sign-out (no-op without POSTHOG_KEY). */}
      <PostHogIdentity userId={null} />
      <div
        className="signin-intro enter flex flex-col gap-3"
        style={{ "--i": 0.8 } as CSSProperties}
      >
        {from === "line" ? (
          <KeptLine fallbackHeadline={SIGN_IN_COPY.headline} />
        ) : (
          <h1 className="font-display text-display-2 text-text">{SIGN_IN_COPY.headline}</h1>
        )}
        <p className="text-text-soft">{SIGN_IN_COPY.intro}</p>
      </div>
      <div className="enter mt-8" style={{ "--i": 2 } as CSSProperties}>
        <SignInForm
          // The widget is shown exactly when the server enforces the check (lib/auth.ts).
          turnstileSiteKey={env.TURNSTILE_SECRET_KEY ? (env.TURNSTILE_SITE_KEY ?? null) : null}
          googleEnabled={googleConfigured(env)}
          notice={noticeForErrorCode(error)}
          theme="night"
        />
      </div>
    </AuthFrame>
  );
}
