import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth, type AuthSession } from "./auth";
import { createGuards } from "./guards";

/** The signed-in session for this request, or null. Deduplicated per request. */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  return getAuth().api.getSession({ headers: await headers() });
});

const guards = createGuards({
  getSession,
  onMissingSession: () => redirect("/sign-in"),
});

/** Server components and actions: the session, or a redirect to /sign-in. */
export const requireSession = guards.requireSession;

/**
 * The session of a user whose email is verified, or EmailNotVerifiedError (403). Gates voice
 * routes from Phase 2 (spec §5.1, §12.4: verified email before any voice session).
 */
export const requireVerifiedEmail = guards.requireVerifiedEmail;
