import { describe, expect, it } from "vitest";
import { googleConfigured, inngestDevMode, isLocalAppUrl, parseServerEnv } from "./env";
import { testEnv } from "./test-env";

describe("parseServerEnv", () => {
  it("needs APP_URL, DATABASE_URL and a long BETTER_AUTH_SECRET, and names each missing one", () => {
    expect(() => parseServerEnv({})).toThrow(/APP_URL[\s\S]*DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
    expect(() => testEnv({ BETTER_AUTH_SECRET: "short" })).toThrow(/at least 32 characters/);
    expect(() => testEnv({ APP_URL: "ftp://example.test" })).toThrow(/APP_URL/);
  });

  it("treats empty optional values as unset and defaults AI_MODE to replay", () => {
    const env = testEnv({ RESEND_API_KEY: "", EMAIL_FROM: "  ", POSTHOG_HOST: "", AI_MODE: "" });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
    expect(env.POSTHOG_HOST).toBeUndefined();
    expect(env.AI_MODE).toBe("replay");
  });

  it("rejects an unknown AI_MODE", () => {
    expect(() => testEnv({ AI_MODE: "record" })).toThrow(/AI_MODE/);
  });

  it("requires Turnstile and Google keys in pairs", () => {
    expect(() => testEnv({ TURNSTILE_SITE_KEY: "site" })).toThrow(/TURNSTILE_SECRET_KEY/);
    expect(() => testEnv({ TURNSTILE_SECRET_KEY: "secret" })).toThrow(/TURNSTILE_SITE_KEY/);
    expect(() => testEnv({ GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(testEnv({ TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" }).TURNSTILE_SITE_KEY).toBe(
      "s",
    );
  });

  it("requires https for APP_URL on any host but localhost (Secure session cookies)", () => {
    const deployed = {};
    expect(() => testEnv({ ...deployed, APP_URL: "http://app.example.test" })).toThrow(
      /APP_URL: APP_URL must use https unless it is localhost/,
    );
    expect(testEnv({ ...deployed, APP_URL: "https://app.example.test" }).APP_URL).toBe(
      "https://app.example.test",
    );
    expect(testEnv({ APP_URL: "http://localhost:3000" }).APP_URL).toBe("http://localhost:3000");
    expect(testEnv({ APP_URL: "http://127.0.0.1:3000" }).APP_URL).toBe("http://127.0.0.1:3000");
  });

  it("allows INNGEST_DEV only on localhost, and needs a signing key everywhere else", () => {
    const deployed = { APP_URL: "https://app.example.test", INNGEST_SIGNING_KEY: undefined };
    // Fail closed: a deployed host must verify that /api/inngest requests are signed.
    expect(() => testEnv(deployed)).toThrow(/INNGEST_SIGNING_KEY: INNGEST_SIGNING_KEY is required/);
    const signed = { ...deployed, INNGEST_SIGNING_KEY: "signkey-test-0123" };
    expect(testEnv(signed).INNGEST_SIGNING_KEY).toBe("signkey-test-0123");

    for (const on of ["1", "true", "TRUE", "http://127.0.0.1:8288"]) {
      expect(() => testEnv({ ...signed, INNGEST_DEV: on }), on).toThrow(
        /INNGEST_DEV: INNGEST_DEV turns off request signing/,
      );
      expect(testEnv({ INNGEST_DEV: on }).INNGEST_DEV, on).toBe(on);
    }
    for (const off of ["0", "false", ""]) {
      expect(() => testEnv({ ...signed, INNGEST_DEV: off }), off).not.toThrow();
    }
  });

  it("rejects an INNGEST_DEV the SDK would silently read as a Dev Server URL", () => {
    // inngest treats any non-boolean string as a URL, so "yes" or "off" would mean dev mode.
    for (const value of ["yes", "off", "no"]) {
      expect(() => testEnv({ INNGEST_DEV: value }), value).toThrow(/INNGEST_DEV must be/);
    }
  });

  it("never echoes secret values in its error", () => {
    const secret = "do-not-print-this";
    const error = (() => {
      try {
        testEnv({ BETTER_AUTH_SECRET: secret });
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error?.message).not.toContain(secret);
  });
});

describe("helpers", () => {
  it("recognises local hosts only", () => {
    expect(isLocalAppUrl("http://localhost:3000")).toBe(true);
    expect(isLocalAppUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalAppUrl("https://app.example.test")).toBe(false);
    expect(isLocalAppUrl("https://localhost.example.test")).toBe(false);
  });

  it("reads INNGEST_DEV the way the Inngest SDK does", () => {
    for (const on of ["1", "true", " True ", "http://127.0.0.1:8288"]) {
      expect(inngestDevMode(on), on).toBe(true);
    }
    for (const off of [undefined, "", "0", "false", "FALSE", "undefined"]) {
      expect(inngestDevMode(off), String(off)).toBe(false);
    }
  });

  it("reports Google as configured only with both credentials", () => {
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })).toBe(true);
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: undefined })).toBe(
      false,
    );
  });
});

describe("marketing env (Phase 9a)", () => {
  it("defaults the hero demo to on with a daily cap of 500, and SITE_URL to unset", () => {
    const env = testEnv();
    expect(env.SITE_URL).toBeUndefined();
    expect(env.DEMO_STT).toBe("on");
    expect(env.DEMO_DAILY_CAP).toBe(500);
    expect(testEnv({ DEMO_STT: "", DEMO_DAILY_CAP: " " })).toMatchObject({
      DEMO_STT: "on",
      DEMO_DAILY_CAP: 500,
    });
  });

  it("reads the kill switch, the cap and the public domain", () => {
    expect(testEnv({ DEMO_STT: "OFF" }).DEMO_STT).toBe("off");
    expect(testEnv({ DEMO_DAILY_CAP: "40" }).DEMO_DAILY_CAP).toBe(40);
    expect(testEnv({ SITE_URL: "https://admitstories.example" }).SITE_URL).toBe(
      "https://admitstories.example",
    );
  });

  it("rejects a malformed switch, cap or domain", () => {
    expect(() => testEnv({ DEMO_STT: "maybe" })).toThrow(/DEMO_STT/);
    expect(() => testEnv({ DEMO_DAILY_CAP: "-1" })).toThrow(/DEMO_DAILY_CAP/);
    expect(() => testEnv({ DEMO_DAILY_CAP: "lots" })).toThrow(/DEMO_DAILY_CAP/);
    expect(() => testEnv({ SITE_URL: "not a url" })).toThrow(/SITE_URL/);
  });
});
