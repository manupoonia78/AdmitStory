import { APP_NAME } from "@admitstory/shared";
import { THEME_COOKIE, parseThemePreference } from "@admitstory/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthFrame } from "@/components/auth-frame";
import { PostHogIdentity } from "@/lib/analytics/posthog-client";
import { googleConfigured, serverEnv } from "@/lib/env";
import { getSession } from "@/lib/session";
import { SIGN_IN_COPY, noticeForErrorCode } from "@/lib/sign-in-copy";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${APP_NAME} with an email link, Google or a passkey.`,
};

/** `?error=` is the only parameter: the code Better Auth adds when it redirects back here. */
const SearchParams = z.object({
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
  const { error } = SearchParams.parse(await searchParams);
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <AuthFrame>
      {/* Signed out: forget any identity from before sign-out (no-op without POSTHOG_KEY). */}
      <PostHogIdentity userId={null} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-graphite">{SIGN_IN_COPY.headline}</h1>
        <p className="text-slate">{SIGN_IN_COPY.intro}</p>
      </div>
      <SignInForm
        // The widget is shown exactly when the server enforces the check (lib/auth.ts).
        turnstileSiteKey={env.TURNSTILE_SECRET_KEY ? (env.TURNSTILE_SITE_KEY ?? null) : null}
        googleEnabled={googleConfigured(env)}
        notice={noticeForErrorCode(error)}
        theme={theme}
      />
    </AuthFrame>
  );
}
