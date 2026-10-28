// Lighthouse on the empty shell (spec §16 Phase 0 AC: "Lighthouse ≥ 90 on the empty shell").
// The owner's reading of the AC: Performance, Accessibility and Best Practices ≥ 90 on the
// mobile preset, for /sign-in and the signed-in /home shell. SEO is left out: app pages are
// noindex by design.
//
//   pnpm lighthouse            (from the repo root; CI runs it after `pnpm build`)
//
// 1. Uses the server on APP_URL if one is running; otherwise starts `next start` (building first
//    if there is no build) and stops it at the end.
// 2. Signs a synthetic user in through the real HTTP API: requests a magic link, reads it from the
//    local outbox, follows it for the session cookie, then records the 18+ and terms
//    confirmation directly in the database (what /welcome's form does).
//    The session cookie is placed in the browser's cookie jar before the signed-in pages.
// 3. Runs Lighthouse three times per page in Playwright's Chromium and keeps the median run,
//    as Lighthouse CI does. Writes apps/web/lighthouse-report-<page>.html for the median run.
// 4. Prints a score table and exits non-zero if any median score is below 0.90.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, confirmAgeAndTerms } from "@admitstory/db";
import { chromium } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import lighthouse from "lighthouse";
import { TERMS_VERSION } from "../lib/terms";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
loadEnv({ path: join(REPO_ROOT, ".env.local"), quiet: true });

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const PORT = new URL(APP_URL).port || "3000";
const OUTBOX = join(REPO_ROOT, ".outbox");
const THRESHOLD = 0.9;
const RUNS = 3;
const CATEGORIES = ["performance", "accessibility", "best-practices"] as const;
const PAGES = [
  { name: "sign-in", path: "/sign-in", signedIn: false },
  { name: "home", path: "/home", signedIn: true },
] as const;

// Cloudflare's documented dummy token. Only Cloudflare's test secret keys accept it, so this
// script can't get past Turnstile on a deployment with real keys (by design).
const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(`${APP_URL}/sign-in`, { redirect: "manual" });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function startServer(): Promise<ChildProcess> {
  if (!existsSync(join(WEB_ROOT, ".next/BUILD_ID"))) {
    console.log("No build found; running next build.");
    const build = spawnSync("pnpm", ["exec", "next", "build"], { cwd: WEB_ROOT, stdio: "inherit" });
    if (build.status !== 0) throw new Error("next build failed");
  }
  console.log(`Starting next start on port ${PORT}.`);
  const server = spawn("pnpm", ["exec", "next", "start", "--port", PORT], {
    cwd: WEB_ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    // Own process group, so the whole tree (pnpm → next) stops together.
    detached: true,
  });
  for (let waited = 0; waited < 120_000; waited += 500) {
    if (await isUp()) return server;
    if (server.exitCode !== null) throw new Error(`next start exited with ${server.exitCode}`);
    await sleep(500);
  }
  throw new Error("next start did not answer within 120 s");
}

function stopServer(server: ChildProcess | null) {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

async function waitForLink(email: string): Promise<{ link: string; file: string }> {
  for (let waited = 0; waited < 15_000; waited += 250) {
    const names = existsSync(OUTBOX) ? (await readdir(OUTBOX)).sort().reverse() : [];
    for (const name of names) {
      const file = join(OUTBOX, name);
      const message = JSON.parse(await readFile(file, "utf8")) as { to: string; text: string };
      if (message.to !== email) continue;
      const link = message.text.match(/https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/)?.[0];
      if (link) return { link, file };
    }
    await sleep(250);
  }
  throw new Error(`No sign-in email to ${email} in ${OUTBOX}`);
}

/** Signs up a synthetic user over HTTP and returns the session cookie and the user id. */
async function createSession(): Promise<{ cookie: string; userId: string }> {
  const email = `test-${randomUUID()}@example.test`;
  const headers: Record<string, string> = { "content-type": "application/json", origin: APP_URL };
  if (process.env.TURNSTILE_SITE_KEY) headers["x-captcha-response"] = TURNSTILE_DUMMY_TOKEN;

  const requested = await fetch(`${APP_URL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, callbackURL: "/home", newUserCallbackURL: "/welcome" }),
  });
  if (!requested.ok) {
    throw new Error(
      `Requesting a sign-in link failed: ${requested.status} ${await requested.text()}`,
    );
  }

  const { link, file } = await waitForLink(email);
  await rm(file, { force: true });
  const verified = await fetch(link, { redirect: "manual" });
  const cookie = verified.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .filter((pair): pair is string => Boolean(pair?.includes("session_token")))
    .join("; ");
  if (!cookie)
    throw new Error(`Following the sign-in link set no session cookie (${verified.status})`);

  const session = (await (
    await fetch(`${APP_URL}/api/auth/get-session`, { headers: { cookie } })
  ).json()) as { user?: { id: string } } | null;
  const userId = session?.user?.id;
  if (!userId) throw new Error("The new session has no user");
  return { cookie, userId };
}

/** "a=1; b=2" → CDP cookies for APP_URL, as Better Auth sets them (HttpOnly, SameSite=Lax). */
function browserCookies(header: string) {
  const { hostname, protocol } = new URL(APP_URL);
  return header.split("; ").map((pair) => {
    const index = pair.indexOf("=");
    return {
      name: pair.slice(0, index),
      value: pair.slice(index + 1),
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: protocol === "https:",
      sameSite: "Lax" as const,
    };
  });
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address ? resolve(address.port) : reject(),
      );
    });
  });
}

type Scores = Record<(typeof CATEGORIES)[number], number>;

interface Run {
  scores: Scores;
  report: string;
  finalUrl: string;
}

function median(runs: Run[]): Run {
  const sorted = [...runs].sort((a, b) => a.scores.performance - b.scores.performance);
  return sorted[Math.floor(sorted.length / 2)] as Run;
}

async function main() {
  let server: ChildProcess | null = null;
  const db = createDb(process.env.DATABASE_URL ?? "", { max: 1 });
  let userId: string | null = null;
  const browser = { close: async () => {} } as { close: () => Promise<void> };

  try {
    if (!(await isUp())) server = await startServer();
    else console.log(`Using the server already running on ${APP_URL}.`);

    const session = await createSession();
    userId = session.userId;
    await confirmAgeAndTerms(db.db, userId, TERMS_VERSION);

    const port = await freePort();
    const chrome = await chromium.launch({
      channel: "chromium",
      args: [`--remote-debugging-port=${port}`],
    });
    browser.close = () => chrome.close();

    const results: { name: string; path: string; runs: Run[] }[] = [];
    let cookieSet = false;
    for (const page of PAGES) {
      if (page.signedIn && !cookieSet) {
        // The session goes into the browser's own cookie jar (Lighthouse keeps cookies between
        // runs), so it applies to redirects and subresources the way it would for a person.
        // Lighthouse's extraHeaders were tried first: Chromium dropped that Cookie header on
        // the navigation, and /home measured as /sign-in.
        const cdp = await chrome.newBrowserCDPSession();
        await cdp.send("Storage.setCookies", { cookies: browserCookies(session.cookie) });
        await cdp.detach();
        cookieSet = true;
      }
      const warmHeaders = page.signedIn ? { cookie: session.cookie } : undefined;
      // Warm the route once, so the first measured load isn't paying for module loading, and
      // check it answers with the page itself rather than a redirect.
      const warm = await fetch(`${APP_URL}${page.path}`, {
        headers: warmHeaders ?? {},
        redirect: "manual",
      });
      if (warm.status !== 200) {
        throw new Error(
          `${page.path} answered ${warm.status} ${warm.headers.get("location") ?? ""}`,
        );
      }

      const runs: Run[] = [];
      for (let i = 0; i < RUNS; i += 1) {
        const result = await lighthouse(`${APP_URL}${page.path}`, {
          port,
          output: "html",
          logLevel: "error",
          onlyCategories: [...CATEGORIES],
        });
        if (!result) throw new Error(`Lighthouse returned no result for ${page.path}`);
        const { lhr, report } = result;
        const finalUrl = lhr.finalDisplayedUrl;
        if (new URL(finalUrl).pathname !== page.path) {
          throw new Error(
            `${page.path} ended on ${finalUrl}; the measured page is not the one asked for`,
          );
        }
        const scores = Object.fromEntries(
          CATEGORIES.map((id) => [id, lhr.categories[id]?.score ?? 0]),
        ) as Scores;
        runs.push({ scores, report: Array.isArray(report) ? report.join("") : report, finalUrl });
      }
      results.push({ name: page.name, path: page.path, runs });
      await writeFile(join(WEB_ROOT, `lighthouse-report-${page.name}.html`), median(runs).report);
    }

    console.log(
      `\nLighthouse (mobile preset), median of ${RUNS} runs; threshold ${THRESHOLD * 100}\n`,
    );
    console.log(
      "Page".padEnd(12),
      ...CATEGORIES.map((c) => c.padStart(16)),
      "   all runs (performance)",
    );
    let failed = false;
    for (const { path, runs } of results) {
      const { scores } = median(runs);
      const cells = CATEGORIES.map((c) => {
        const score = Math.round(scores[c] * 100);
        if (scores[c] < THRESHOLD) failed = true;
        return `${score}${scores[c] < THRESHOLD ? " (below)" : ""}`.padStart(16);
      });
      const perfRuns = runs.map((r) => Math.round(r.scores.performance * 100)).join(", ");
      console.log(path.padEnd(12), ...cells, `   ${perfRuns}`);
    }
    console.log(
      `\nReports: ${PAGES.map((p) => `apps/web/lighthouse-report-${p.name}.html`).join(", ")}`,
    );
    if (failed) {
      console.error(`\nAt least one score is below ${THRESHOLD * 100}.`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    if (userId) await db.pool.query("delete from users where id = $1", [userId]);
    await db.pool.end();
    stopServer(server);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
