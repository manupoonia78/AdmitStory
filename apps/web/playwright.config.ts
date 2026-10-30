import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";

// End-to-end smoke tests (spec §15, §16 Phase 0). Chromium only. The app runs under `next start`
// (a production build) on APP_URL, with the repo-root .env.local loaded the same way as
// next.config.ts. CI sets the variables directly and has already run `pnpm build`.

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
loadEnv({ path: `${REPO_ROOT}.env.local`, quiet: true });

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const PORT = new URL(APP_URL).port || "3000";
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // One server, one in-memory rate limiter, shared sign-in state: run in order, one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /signed-in\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium",
      testIgnore: /\.setup\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Builds only when there is no build yet (CI builds in an earlier step).
    command: `sh -c '[ -f .next/BUILD_ID ] || pnpm exec next build; exec pnpm exec next start --port ${PORT}'`,
    url: `${APP_URL}/sign-in`,
    // The Phase 0.5 prototypes are off in production builds unless this is set (app/prototype).
    env: { ...(process.env as Record<string, string>), PROTOTYPES_ENABLED: "1" },
    reuseExistingServer: !CI,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
