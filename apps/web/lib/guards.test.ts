import { describe, expect, it, vi } from "vitest";
import {
  EmailNotVerifiedError,
  NotSignedInError,
  WelcomeNotCompletedError,
  createGuards,
  createOnboardingGuard,
  hasCompletedWelcome,
  type GuardSession,
} from "./guards";

// Synthetic user (spec §0).
const verified: GuardSession = {
  user: {
    id: "8a6e0f53-0d0e-4c43-9a51-7f3d3b0e9c11",
    email: "test-1@example.test",
    emailVerified: true,
  },
};
const unverified: GuardSession = {
  user: { ...verified.user, email: "test-2@example.test", emailVerified: false },
};

describe("requireSession", () => {
  it("returns the session when there is one", async () => {
    const { requireSession } = createGuards({ getSession: async () => verified });
    await expect(requireSession()).resolves.toBe(verified);
  });

  it("throws NotSignedInError (401) without a session by default", async () => {
    const { requireSession } = createGuards({ getSession: async () => null });
    const error = await requireSession().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotSignedInError);
    expect((error as NotSignedInError).status).toBe(401);
  });

  it("uses onMissingSession (the redirect to /sign-in in pages) when given", async () => {
    const redirect = vi.fn((): never => {
      throw new Error("NEXT_REDIRECT /sign-in");
    });
    const { requireSession } = createGuards({
      getSession: async () => null,
      onMissingSession: redirect,
    });
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT /sign-in");
    expect(redirect).toHaveBeenCalledOnce();
  });
});

describe("requireVerifiedEmail", () => {
  it("lets a verified user through", async () => {
    const { requireVerifiedEmail } = createGuards({ getSession: async () => verified });
    await expect(requireVerifiedEmail()).resolves.toBe(verified);
  });

  it("rejects an unverified user with EmailNotVerifiedError (403)", async () => {
    const { requireVerifiedEmail } = createGuards({ getSession: async () => unverified });
    const error = await requireVerifiedEmail().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailNotVerifiedError);
    expect((error as EmailNotVerifiedError).status).toBe(403);
    expect((error as Error).message).not.toMatch(/oops|something went wrong|!/i);
  });

  it("checks for a session first", async () => {
    const { requireVerifiedEmail } = createGuards({ getSession: async () => null });
    await expect(requireVerifiedEmail()).rejects.toBeInstanceOf(NotSignedInError);
  });

  it("treats a missing emailVerified flag as unverified", async () => {
    const odd = { user: { ...verified.user, emailVerified: undefined as unknown as boolean } };
    const { requireVerifiedEmail } = createGuards({ getSession: async () => odd });
    await expect(requireVerifiedEmail()).rejects.toBeInstanceOf(EmailNotVerifiedError);
  });
});

describe("requireOnboardedUser (createOnboardingGuard)", () => {
  const confirmed = new Date("2026-10-01T00:00:00Z");
  const welcomed = {
    session: verified,
    profile: { ageConfirmedAt: confirmed, termsAcceptedAt: confirmed },
  };
  const ageOnly = {
    session: verified,
    profile: { ageConfirmedAt: confirmed, termsAcceptedAt: null },
  };
  const termsOnly = {
    session: verified,
    profile: { ageConfirmedAt: null, termsAcceptedAt: confirmed },
  };

  it("needs both the 18+ confirmation and the commitments", () => {
    expect(hasCompletedWelcome(welcomed.profile)).toBe(true);
    expect(hasCompletedWelcome(ageOnly.profile)).toBe(false);
    expect(hasCompletedWelcome(termsOnly.profile)).toBe(false);
    expect(hasCompletedWelcome({ ageConfirmedAt: null, termsAcceptedAt: null })).toBe(false);
  });

  it("returns the user once the welcome gate is passed", async () => {
    const onNotOnboarded = vi.fn((): never => {
      throw new Error("NEXT_REDIRECT /welcome");
    });
    const guard = createOnboardingGuard({ getAppUser: async () => welcomed, onNotOnboarded });
    await expect(guard()).resolves.toBe(welcomed);
    expect(onNotOnboarded).not.toHaveBeenCalled();
  });

  it("redirects pages to /welcome (onNotOnboarded) before the gate is passed", async () => {
    for (const user of [ageOnly, termsOnly]) {
      const onNotOnboarded = vi.fn((): never => {
        throw new Error("NEXT_REDIRECT /welcome");
      });
      const guard = createOnboardingGuard({ getAppUser: async () => user, onNotOnboarded });
      await expect(guard()).rejects.toThrow("NEXT_REDIRECT /welcome");
      expect(onNotOnboarded).toHaveBeenCalledOnce();
    }
  });

  it("throws WelcomeNotCompletedError (403) in server actions", async () => {
    const guard = createOnboardingGuard({ getAppUser: async () => ageOnly });
    const error = await guard().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WelcomeNotCompletedError);
    expect((error as WelcomeNotCompletedError).status).toBe(403);
    expect((error as Error).message).not.toMatch(/oops|something went wrong|!/i);
  });

  it("lets a missing session fail first (requireAppUser's redirect to /sign-in)", async () => {
    const guard = createOnboardingGuard({
      getAppUser: async (): Promise<typeof welcomed> => {
        throw new NotSignedInError();
      },
    });
    await expect(guard()).rejects.toBeInstanceOf(NotSignedInError);
  });
});
