import { describe, expect, it, vi } from "vitest";
import { testEnv } from "./test-env";

vi.mock("server-only", () => ({}));
const onUserCreated = vi.fn(async () => {});
vi.mock("@admitstory/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@admitstory/db")>()),
  onUserCreated: (...args: unknown[]) => onUserCreated(...(args as [])),
}));

const { createAuthOptions, socialProviders } = await import("./auth");
const { CAPTCHA_ENDPOINTS, MAGIC_LINK_MINUTES, MAGIC_LINK_RATE_LIMIT } =
  await import("./auth-constants");

// No queries run: the options builder only wraps the handle in the Drizzle adapter.
const fakeDeps = {
  db: {} as never,
  sendMagicLink: vi.fn(async () => {}),
  afterUserCreated: vi.fn(async () => {}),
};

const TURNSTILE = {
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
};

function pluginIds(options: ReturnType<typeof createAuthOptions>) {
  return options.plugins.map((plugin) => plugin.id);
}

describe("Google provider", () => {
  it("is configured only when both credentials exist", () => {
    expect(socialProviders(testEnv())).toEqual({});
    const providers = socialProviders(
      testEnv({
        GOOGLE_CLIENT_ID: "client-id.apps.example.test",
        GOOGLE_CLIENT_SECRET: "client-secret",
      }),
    );
    expect(providers?.google).toMatchObject({
      clientId: "client-id.apps.example.test",
      clientSecret: "client-secret",
      prompt: "select_account",
    });
  });

  it("flows into the auth options", () => {
    const withGoogle = createAuthOptions(
      testEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }),
      fakeDeps,
    );
    expect(Object.keys(withGoogle.socialProviders ?? {})).toEqual(["google"]);
    expect(createAuthOptions(testEnv(), fakeDeps).socialProviders).toEqual({});
  });
});

describe("createAuthOptions", () => {
  const options = createAuthOptions(testEnv(TURNSTILE), fakeDeps);

  it("has no passwords, uuid ids and the app's own URL", () => {
    expect(options.emailAndPassword).toEqual({ enabled: false });
    expect(options.advanced.database.generateId).toBe("uuid");
    expect(options.baseURL).toBe("http://localhost:3000");
    expect(options.appName).toBeTruthy();
  });

  it("uses magic link, passkey, captcha and nextCookies (last)", () => {
    expect(pluginIds(options)).toEqual(["magic-link", "passkey", "captcha", "next-cookies"]);
  });

  it("guards exactly the magic-link endpoint with Turnstile", () => {
    const captcha = options.plugins.find((plugin) => plugin.id === "captcha") as unknown as {
      options: { provider: string; endpoints: string[]; secretKey: string };
    };
    expect(captcha.options.provider).toBe("cloudflare-turnstile");
    expect(captcha.options.endpoints).toEqual(CAPTCHA_ENDPOINTS);
    expect(CAPTCHA_ENDPOINTS).toEqual(["/sign-in/magic-link"]);
  });

  it("checks the Turnstile hostname and action on real hosts only", () => {
    const captchaOf = (o: ReturnType<typeof createAuthOptions>) =>
      (
        o.plugins.find((plugin) => plugin.id === "captcha") as unknown as {
          options: { allowedHostnames?: string[]; expectedAction?: string };
        }
      ).options;
    expect(captchaOf(options).allowedHostnames).toBeUndefined();
    const deployed = createAuthOptions(
      testEnv({ ...TURNSTILE, APP_URL: "https://app.example.test" }),
      fakeDeps,
    );
    expect(captchaOf(deployed)).toMatchObject({
      allowedHostnames: ["app.example.test"],
      expectedAction: "magic-link",
    });
  });

  it("binds passkeys to the APP_URL host", () => {
    const passkey = options.plugins.find((plugin) => plugin.id === "passkey") as unknown as {
      options: { rpID: string; origin: string; rpName: string };
    };
    expect(passkey.options).toMatchObject({ rpID: "localhost", origin: "http://localhost:3000" });
    const deployed = createAuthOptions(
      testEnv({ ...TURNSTILE, APP_URL: "https://app.example.test" }),
      fakeDeps,
    );
    const deployedPasskey = deployed.plugins.find(
      (plugin) => plugin.id === "passkey",
    ) as unknown as {
      options: { rpID: string; origin: string };
    };
    expect(deployedPasskey.options).toMatchObject({
      rpID: "app.example.test",
      origin: "https://app.example.test",
    });
  });

  it("keeps sign-in links short-lived and rate limited", () => {
    const magic = options.plugins.find((plugin) => plugin.id === "magic-link") as unknown as {
      options: { expiresIn: number; rateLimit: unknown; storeToken: string };
    };
    expect(magic.options.expiresIn).toBe(MAGIC_LINK_MINUTES * 60);
    expect(magic.options.storeToken).toBe("hashed");
    expect(options.rateLimit.customRules["/sign-in/magic-link"]).toEqual(MAGIC_LINK_RATE_LIMIT);
    expect(createAuthOptions(testEnv({ NODE_ENV: "production" }), fakeDeps).rateLimit.enabled).toBe(
      true,
    );
  });

  it("skips Turnstile on localhost without keys but refuses to run unprotected elsewhere", () => {
    expect(pluginIds(createAuthOptions(testEnv(), fakeDeps))).not.toContain("captcha");
    expect(() =>
      createAuthOptions(testEnv({ APP_URL: "https://app.example.test" }), fakeDeps),
    ).toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it("creates the profile and role, then emits user/created, after a user is created", async () => {
    const after = options.databaseHooks.user.create.after;
    await after({ id: "6f0d2a8c-1b3e-4c5d-9e7f-0a1b2c3d4e5f" } as never);
    expect(onUserCreated).toHaveBeenCalledWith(fakeDeps.db, "6f0d2a8c-1b3e-4c5d-9e7f-0a1b2c3d4e5f");
    expect(fakeDeps.afterUserCreated).toHaveBeenCalledWith("6f0d2a8c-1b3e-4c5d-9e7f-0a1b2c3d4e5f");
  });
});
