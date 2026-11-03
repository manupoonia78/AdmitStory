import "server-only";

import { getDb, getProfile, onUserCreated, type Profile } from "@admitstory/db";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AuthSession } from "./auth";
import { createOnboardingGuard, hasCompletedWelcome } from "./guards";
import { requireApiSession, requireSession } from "./session";

export { hasCompletedWelcome };

export interface AppUser {
  session: AuthSession;
  profile: Profile;
}

async function withProfile(session: AuthSession): Promise<AppUser> {
  const db = getDb();
  let profile = await getProfile(db, session.user.id);
  if (!profile) {
    await onUserCreated(db, session.user.id);
    profile = await getProfile(db, session.user.id);
  }
  if (!profile) throw new Error("The profile could not be created for the signed-in user.");
  return { session, profile };
}

/**
 * The signed-in user and their profile, deduplicated per request. Redirects to /sign-in without a
 * session. If the sign-up hook failed after the user row was written, the profile is created here
 * (onUserCreated is idempotent), so an account never gets stuck without one.
 */
export const requireAppUser = cache(async (): Promise<AppUser> =>
  withProfile(await requireSession()),
);

/** The same for route handlers: NotSignedInError (401) without a session, never a redirect. */
const requireApiAppUser = cache(async (): Promise<AppUser> =>
  withProfile(await requireApiSession()),
);

const onboardingGuards = {
  page: cache(
    createOnboardingGuard({
      getAppUser: requireAppUser,
      onNotOnboarded: () => redirect("/welcome"),
    }),
  ),
  action: createOnboardingGuard({ getAppUser: requireAppUser }),
  api: createOnboardingGuard({ getAppUser: requireApiAppUser }),
};

/**
 * The signed-in user once the welcome gate (18+ and the integrity commitments) is passed. Every
 * (app) page calls it (the default, `"page"`: redirects to /welcome), and every server action that
 * acts for the user calls it with `"action"`, which throws WelcomeNotCompletedError (403) instead.
 * Route handlers use `"api"` (through lib/api.ts requireUser): no session is NotSignedInError (401).
 * The (app) layout's own check is for UX only: it doesn't protect pages rendered beside it, and it
 * never runs for a server action.
 */
export function requireOnboardedUser(from: "page" | "action" | "api" = "page"): Promise<AppUser> {
  return onboardingGuards[from]();
}

/** Name for the account menu: the user's name if they have one, otherwise their email. */
export function displayName(user: { name: string; email: string }): string {
  return user.name.trim() || user.email;
}
