// Session guards, independent of Next and Better Auth so they can be unit-tested with fakes.

export interface GuardSession {
  user: { id: string; email: string; emailVerified: boolean };
}

export class NotSignedInError extends Error {
  readonly status = 401;
  constructor() {
    super("Sign in to continue.");
    this.name = "NotSignedInError";
  }
}

export class EmailNotVerifiedError extends Error {
  readonly status = 403;
  constructor() {
    super("Confirm your email address before starting a voice session.");
    this.name = "EmailNotVerifiedError";
  }
}

export interface GuardDeps<S extends GuardSession> {
  getSession: () => Promise<S | null>;
  /** What to do without a session. Pages redirect; the default throws NotSignedInError. */
  onMissingSession?: () => never;
}

export function createGuards<S extends GuardSession>({
  getSession,
  onMissingSession,
}: GuardDeps<S>) {
  async function requireSession(): Promise<S> {
    const session = await getSession();
    if (session) return session;
    if (onMissingSession) onMissingSession();
    throw new NotSignedInError();
  }

  async function requireVerifiedEmail(): Promise<S> {
    const session = await requireSession();
    if (session.user.emailVerified !== true) throw new EmailNotVerifiedError();
    return session;
  }

  return { requireSession, requireVerifiedEmail };
}

export class WelcomeNotCompletedError extends Error {
  readonly status = 403;
  constructor() {
    super("Confirm that you're 18 or older and agree to the commitments on /welcome to continue.");
    this.name = "WelcomeNotCompletedError";
  }
}

export interface WelcomeProfile {
  ageConfirmedAt: Date | null;
  termsAcceptedAt: Date | null;
}

/** True once the 18+ confirmation and integrity commitments are recorded (spec §14.4, §14.7). */
export function hasCompletedWelcome(profile: WelcomeProfile): boolean {
  return profile.ageConfirmedAt !== null && profile.termsAcceptedAt !== null;
}

export interface OnboardingGuardDeps<U extends { profile: WelcomeProfile }> {
  /** The signed-in user and profile (requireAppUser, which handles a missing session itself). */
  getAppUser: () => Promise<U>;
  /** What to do before the welcome gate is passed. Pages redirect; the default throws. */
  onNotOnboarded?: () => never;
}

/**
 * The guard behind requireOnboardedUser: a signed-in user who has passed the welcome gate. Every
 * page and server action checks it on its own request; the (app) layout's check is only UX, since
 * Next renders a layout and its page in parallel and a server action never runs the layout.
 */
export function createOnboardingGuard<U extends { profile: WelcomeProfile }>({
  getAppUser,
  onNotOnboarded,
}: OnboardingGuardDeps<U>) {
  return async function requireOnboardedUser(): Promise<U> {
    const user = await getAppUser();
    if (hasCompletedWelcome(user.profile)) return user;
    if (onNotOnboarded) onNotOnboarded();
    throw new WelcomeNotCompletedError();
  };
}
