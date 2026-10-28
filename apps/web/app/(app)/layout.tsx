import { AppShell, THEME_COOKIE, parseThemePreference } from "@admitstory/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PostHogIdentity } from "@/lib/analytics/posthog-client";
import { displayName, hasCompletedWelcome, requireAppUser } from "@/lib/app-user";
import { signOut } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const { session, profile } = await requireAppUser();
  // First sign-in gate: 18+ and the integrity commitments come before anything else.
  if (!hasCompletedWelcome(profile)) redirect("/welcome");

  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
  const { user } = session;

  return (
    <>
      <PostHogIdentity userId={user.id} />
      <AppShell
        user={{ name: displayName(user), email: user.email }}
        onSignOut={signOut}
        themeServerValue={theme}
      >
        {children}
      </AppShell>
    </>
  );
}
