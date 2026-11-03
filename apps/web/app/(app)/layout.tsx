import {
  AppShell,
  THEME_COOKIE,
  ToastProvider,
  parseThemePreference,
  type CommandAction,
} from "@admitstory/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PostHogIdentity } from "@/lib/analytics/posthog-client";
import { displayName, hasCompletedWelcome, requireAppUser } from "@/lib/app-user";
import { signOut } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** ⌘K entries beyond the dock's destinations. Recommenders has no dock item (Phase 6 decision 22). */
const ACTIONS: readonly CommandAction[] = [
  {
    id: "open-recommenders",
    label: "Open your recommenders",
    href: "/recommenders",
    keywords: ["recommendation", "recommender", "letters", "brief", "LOR"],
  },
];

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const { session, profile } = await requireAppUser();
  // First sign-in gate: 18+ and the integrity commitments come before anything else.
  if (!hasCompletedWelcome(profile)) redirect("/welcome");

  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
  const { user } = session;

  // The root layout has no ToastProvider (marketing plan D1): the app brings its own.
  return (
    <ToastProvider>
      <PostHogIdentity userId={user.id} />
      <AppShell
        user={{ name: displayName(user), email: user.email }}
        onSignOut={signOut}
        actions={ACTIONS}
        themeServerValue={theme}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
