import { parseServerEnv, type ServerEnv } from "./env";

/**
 * A valid server env for unit tests. Synthetic values only; nothing here is a real secret. It has
 * an Inngest signing key so that an `APP_URL` override to a deployed (https) host is still valid;
 * pass `INNGEST_SIGNING_KEY: undefined` to test without one.
 */
export function testEnv(overrides: Record<string, string | undefined> = {}): ServerEnv {
  return parseServerEnv({
    NODE_ENV: "test",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgres://user@127.0.0.1:5433/test",
    BETTER_AUTH_SECRET: "unit-test-secret-unit-test-secret-0123",
    INNGEST_SIGNING_KEY: "signkey-test-unit-0123",
    ...overrides,
  });
}
