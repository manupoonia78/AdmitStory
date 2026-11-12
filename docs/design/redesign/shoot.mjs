#!/usr/bin/env node
// Screenshots of every screen in the redesign brief (docs/design/fable-redesign-prompt.md).
//
//   node docs/design/redesign/shoot.mjs                      before/, Day, every route
//   node docs/design/redesign/shoot.mjs --out after          after/ (as each screen lands)
//   node docs/design/redesign/shoot.mjs --theme night        Night theme, files end "-night"
//   node docs/design/redesign/shoot.mjs --only landing,home  only routes whose name contains these
//   node docs/design/redesign/shoot.mjs --public             skip sign-in and signed-in routes
//   node docs/design/redesign/shoot.mjs --app                signed-in routes only
//   node docs/design/redesign/shoot.mjs --reduced            prefers-reduced-motion, files end "-rm"
//
// Per route it writes, into docs/design/redesign/shots/<out>/:
//   <name>-1440.jpg        1440×900 viewport (what the rubric's "first glance" judges)
//   <name>-1440-full.jpg   the whole page at 1440 wide
//   <name>-390.jpg         390×844 phone viewport (2x)
//   <name>-390-full.jpg    the whole page at 390 wide
// and one report.json: the 375px horizontal-overflow check, console errors, failed requests and
// hydration warnings for every route.
//
// The app must already be running against the LOCAL database (see local-db.md). The script
// refuses any base URL that is not localhost, and never touches a database itself: it signs in
// through the magic link in .outbox and sets up sample data through the app's own API.
//
// Browser: Playwright's bundled browsers can't be downloaded in the sandbox, so it drives the
// installed Google Chrome (channel "chrome").

import { chromium } from "@playwright/test";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const OUTBOX = join(REPO, ".outbox");

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  return value === undefined || value.startsWith("--") ? true : value;
}

const BASE = String(flag("base", "http://localhost:3100")).replace(/\/$/, "");
const OUT = String(flag("out", "before"));
const THEME = String(flag("theme", "day"));
const ONLY = flag("only", null);
const PUBLIC_ONLY = flag("public", false) === true;
const APP_ONLY = flag("app", false) === true;
const REDUCED = flag("reduced", false) === true;
const EMAIL = String(flag("email", "redesign-shots@example.test"));
const SUFFIX = `${THEME === "night" ? "-night" : ""}${REDUCED ? "-rm" : ""}`;
const SHOTS = join(HERE, "shots", OUT);

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE}: screenshots are taken from localhost only.`);
  process.exit(1);
}

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 375, height: 812 };

// ---------------------------------------------------------------------------------------------
// Routes. `path` may be a function of the ids found by prepare(); a route whose id is missing is
// reported as skipped, never silently dropped. `load: true` waits for "load" only (Turnstile and
// polling screens never go network-idle).
// ---------------------------------------------------------------------------------------------

const PUBLIC_ROUTES = [
  { name: "landing", path: "/" },
  { name: "how-it-works", path: "/how-it-works" },
  { name: "pricing", path: "/pricing" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "sign-in", path: "/sign-in", load: true },
  { name: "portal-resend", path: "/r" },
  { name: "portal-closed", path: "/r/not-a-real-link" },
  { name: "goodbye", path: "/goodbye" },
  { name: "not-found", path: "/this-page-does-not-exist" },
];

const APP_ROUTES = [
  { name: "home", path: "/home" },
  { name: "studio", path: "/studio", load: true },
  { name: "dossier", path: "/dossier" },
  { name: "profile-read", path: "/profile-read" },
  { name: "schools", path: "/schools" },
  { name: "school", path: (ids) => ids.school && `/schools/${ids.school}` },
  { name: "school-unlocked", path: (ids) => ids.unlocked && `/schools/${ids.unlocked}` },
  { name: "school-preview", path: (ids) => ids.school && `/schools/${ids.school}/preview` },
  { name: "school-unlock", path: (ids) => ids.school && `/schools/${ids.school}/unlock` },
  {
    name: "school-recommenders",
    path: (ids) =>
      (ids.unlocked ?? ids.school) && `/schools/${ids.unlocked ?? ids.school}/recommenders`,
  },
  {
    name: "school-resume",
    path: (ids) => (ids.unlocked ?? ids.school) && `/schools/${ids.unlocked ?? ids.school}/resume`,
  },
  { name: "kit", path: (ids) => ids.kit && `/kits/${ids.kit}`, load: true },
  {
    name: "workspace",
    path: (ids) => ids.deliverable && `/workspace/${ids.deliverable}`,
    load: true,
  },
  { name: "recommenders", path: "/recommenders" },
  { name: "recommender", path: (ids) => ids.recommender && `/recommenders/${ids.recommender}` },
  { name: "resume", path: "/resume" },
  { name: "resume-review", path: "/resume/review" },
  { name: "connect", path: "/connect", load: true },
  { name: "settings", path: "/settings" },
  { name: "settings-privacy", path: "/settings/privacy" },
  { name: "settings-security", path: "/settings/security" },
  { name: "interview", path: "/interview" },
  { name: "tracker", path: "/tracker" },
];

// The Phase 0.5 prototypes run on sample data, so they show the populated editor, Studio, kit
// assembly and interview room that a fresh local account can't reach without live AI. They are
// reference only (out of redesign scope) and exist only when the app runs with PROTOTYPES_ENABLED=1.
const REFERENCE_ROUTES = [
  { name: "ref-prototype-studio", path: "/prototype/studio", load: true, optional: true },
  { name: "ref-prototype-workspace", path: "/prototype/workspace", load: true, optional: true },
  { name: "ref-prototype-kit", path: "/prototype/kit", load: true, optional: true },
  { name: "ref-prototype-duet", path: "/prototype/duet", load: true, optional: true },
];

// ---------------------------------------------------------------------------------------------

const report = {
  base: BASE,
  out: OUT,
  theme: THEME,
  reduced: REDUCED,
  takenAt: null,
  routes: [],
  setup: [],
};
const note = (message) => {
  report.setup.push(message);
  console.log(`  · ${message}`);
};

function wanted(name) {
  if (!ONLY || ONLY === true) return true;
  return String(ONLY)
    .split(",")
    .some((part) => name.includes(part.trim()));
}

function contextOptions(viewport, phone) {
  return {
    viewport,
    deviceScaleFactor: phone ? 2 : 1,
    isMobile: phone,
    hasTouch: phone,
    locale: "en-US",
    timezoneId: "America/New_York",
    colorScheme: THEME === "night" ? "dark" : "light",
    reducedMotion: REDUCED ? "reduce" : "no-preference",
  };
}

async function setTheme(context) {
  await context.addCookies([
    { name: "theme", value: THEME === "night" ? "night" : "day", url: BASE },
  ]);
}

/** Scrolls the page top to bottom and back, so lazy islands load and scroll reveals have fired. */
async function settle(page) {
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    const height = () => document.documentElement.scrollHeight;
    for (let y = 0; y < height(); y += step) {
      window.scrollTo(0, y);
      await pause(120);
    }
    window.scrollTo(0, 0);
    await pause(400);
  });
}

async function open(page, route, path) {
  const response = await page.goto(BASE + path, { waitUntil: "load", timeout: 45_000 });
  if (!route.load) await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(1_200);
  return response;
}

async function shoot(page, name, size) {
  const file = (kind) => join(SHOTS, `${name}-${size}${kind}${SUFFIX}.jpg`);
  await page.screenshot({ path: file(""), type: "jpeg", quality: 88 });
  await settle(page);
  await page.screenshot({ path: file("-full"), type: "jpeg", quality: 60, fullPage: true });
}

function listen(page, entry) {
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (/hydrat/i.test(text)) entry.hydration.push(text.slice(0, 300));
    else if (message.type() === "error") entry.consoleErrors.push(text.slice(0, 300));
  });
  page.on("pageerror", (error) =>
    entry.consoleErrors.push(`pageerror: ${error.message.slice(0, 300)}`),
  );
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    if (failure.includes("ERR_ABORTED")) return; // navigations cancel in-flight prefetches
    entry.failedRequests.push(`${request.method()} ${request.url().replace(BASE, "")} ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(BASE))
      entry.failedRequests.push(`${response.status()} ${response.url().replace(BASE, "")}`);
  });
}

async function capture(contexts, route, ids) {
  const path = typeof route.path === "function" ? route.path(ids) : route.path;
  const entry = {
    name: route.name,
    path: path ?? null,
    consoleErrors: [],
    failedRequests: [],
    hydration: [],
  };
  report.routes.push(entry);
  if (!path) {
    entry.skipped = "no local data for this route (see setup notes)";
    console.log(`– ${route.name}: skipped, ${entry.skipped}`);
    return;
  }
  for (const [size, context] of [
    ["1440", contexts.desktop],
    ["390", contexts.phone],
  ]) {
    const page = await context.newPage();
    listen(page, entry);
    try {
      const response = await open(page, route, path);
      entry.status = response?.status() ?? null;
      entry.finalPath = page.url().replace(BASE, "");
      if (route.optional && entry.status === 404) {
        entry.skipped = "not enabled on this server";
        await page.close();
        break;
      }
      await shoot(page, route.name, size);
      if (size === "390") {
        // The 375px check: nothing may scroll sideways.
        await page.setViewportSize(NARROW);
        await page.waitForTimeout(300);
        entry.overflow375 = await page.evaluate(() => {
          const root = document.documentElement;
          const over = root.scrollWidth - root.clientWidth;
          if (over <= 0) return { px: 0, offenders: [] };
          const offenders = [];
          for (const el of document.querySelectorAll("body *")) {
            const rect = el.getBoundingClientRect();
            if (rect.right > root.clientWidth + 1 && rect.width > 0) {
              offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
              if (offenders.length >= 5) break;
            }
          }
          return { px: over, offenders };
        });
      }
    } catch (error) {
      entry.error = String(error?.message ?? error).slice(0, 300);
    }
    await page.close();
  }
  const flags = [
    entry.error && `ERROR ${entry.error}`,
    entry.skipped,
    entry.finalPath && entry.finalPath !== path && `→ ${entry.finalPath}`,
    entry.overflow375?.px > 0 && `overflow ${entry.overflow375.px}px at 375`,
    entry.consoleErrors.length > 0 && `${entry.consoleErrors.length} console error(s)`,
    entry.hydration.length > 0 && `${entry.hydration.length} hydration warning(s)`,
  ].filter(Boolean);
  console.log(
    `${flags.length ? "!" : "✓"} ${route.name}${flags.length ? `: ${flags.join("; ")}` : ""}`,
  );
}

// ---------------------------------------------------------------------------------------------
// Sign-in: the magic link the app writes to .outbox when APP_URL is localhost and RESEND is blank.
// ---------------------------------------------------------------------------------------------

async function takeMagicLink(email, since) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const names = await readdir(OUTBOX).catch(() => []);
    for (const name of names
      .filter((n) => n.endsWith(".json"))
      .sort()
      .reverse()) {
      const file = join(OUTBOX, name);
      const message = JSON.parse(await readFile(file, "utf8"));
      if (message.to !== email || new Date(message.sentAt) < since) continue;
      const link = message.text.match(/https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/)?.[0];
      await rm(file, { force: true });
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `No sign-in email for ${email} in .outbox. Is RESEND_API_KEY blank and APP_URL localhost?`,
  );
}

async function shootBothSizes(page, name) {
  for (const [size, viewport] of [
    ["1440", DESKTOP],
    ["390", PHONE],
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(SHOTS, `${name}-${size}${SUFFIX}.jpg`),
      type: "jpeg",
      quality: 88,
    });
  }
  await page.setViewportSize(DESKTOP);
}

/** Signs in, capturing /welcome and each /first-run step the first time the account passes them. */
async function signIn(context) {
  const page = await context.newPage();
  const since = new Date(Date.now() - 2_000);
  await page.goto(`${BASE}/sign-in`, { waitUntil: "load" });
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 20_000 });
  if (wanted("sign-in-sent")) await shootBothSizes(page, "sign-in-sent");
  await page.goto(await takeMagicLink(EMAIL, since), { waitUntil: "load" });
  await page.waitForURL(/\/(welcome|home|first-run|studio)/, { timeout: 20_000 });

  if (page.url().endsWith("/welcome")) {
    await page.waitForTimeout(1_000);
    await shootBothSizes(page, "welcome");
    await page.getByLabel("I'm 18 or older.").check();
    await page.getByLabel("I agree to these commitments.").check();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await page.waitForURL(/\/(home|first-run)/, { timeout: 20_000 });
    note("welcome: captured, then agreed");
  }

  // /first-run redirects to /studio once it has been completed, so its four steps can only be
  // captured on a fresh account.
  await page.goto(`${BASE}/first-run`, { waitUntil: "load" });
  await page.waitForTimeout(1_200);
  if (page.url().endsWith("/first-run")) {
    await shootBothSizes(page, "first-run-1-applying");
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(700);
    await shootBothSizes(page, "first-run-2-where");
    await page
      .getByLabel("Your current role, in one line")
      .fill("Systems analyst at a regional hospital group");
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(700);
    await shootBothSizes(page, "first-run-3-bring");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForTimeout(700);
    await shootBothSizes(page, "first-run-4-time");
    await page.getByRole("button", { name: "Start talking" }).click();
    await page.waitForURL(/\/studio/, { timeout: 30_000 }).catch(() => {});
    note(`first-run: four steps captured, finished at ${page.url().replace(BASE, "")}`);
  } else {
    note(
      "first-run: already completed for this account (use --email for a fresh one to recapture)",
    );
  }
  await page.close();
}

// ---------------------------------------------------------------------------------------------
// Sample data through the app's own API, as the signed-in user: three schools, one of them
// unlocked with the localhost-only test checkout, and one recommender. Every step is best-effort
// and idempotent; what couldn't be set up is written to report.json.
// ---------------------------------------------------------------------------------------------

async function prepare(context) {
  const ids = {};
  const api = context.request;
  const json = async (response) => response.json().catch(() => null);

  try {
    let mine = (await json(await api.get(`${BASE}/api/user-schools`)))?.schools ?? [];
    if (mine.length < 3) {
      const found = (await json(await api.get(`${BASE}/api/schools?q=`)))?.schools ?? [];
      for (const card of found) {
        if (mine.length >= 3) break;
        const cycleId = card.schoolCycleId ?? card.cycle?.id ?? card.cycleId;
        if (!cycleId || card.comingSoon || card.pack === null) continue;
        if (mine.some((s) => s.schoolCycleId === cycleId)) continue;
        const added = await api.post(`${BASE}/api/user-schools`, {
          data: { schoolCycleId: cycleId },
        });
        if (added.ok())
          mine = (await json(await api.get(`${BASE}/api/user-schools`)))?.schools ?? [];
        else note(`add school failed (${added.status()}): ${(await added.text()).slice(0, 120)}`);
      }
    }
    note(
      `schools on the list: ${mine.map((s) => s.school?.shortName ?? s.school?.name).join(", ") || "none"}`,
    );

    // One unlocked school, the rest left as free previews.
    for (const school of mine) {
      const kit = await json(await api.get(`${BASE}/api/user-schools/${school.id}/kit`));
      if (kit?.kitId) {
        ids.unlocked = school.id;
        ids.kit = kit.kitId;
        break;
      }
    }
    if (!ids.unlocked && mine[0]) {
      const session = await api.post(`${BASE}/api/checkout/session`, {
        data: { userSchoolId: mine[0].id, plan: "school_kit" },
        headers: { "Idempotency-Key": `shots-${mine[0].id}` },
      });
      const body = await json(session);
      const transactionId = body?.transactionId ?? body?.checkoutId ?? body?.id;
      if (session.ok() && transactionId) {
        const paid = await api.post(`${BASE}/api/dev/fake-checkout`, {
          data: { transactionId, outcome: "paid" },
        });
        if (!paid.ok())
          note(`test checkout failed (${paid.status()}): ${(await paid.text()).slice(0, 120)}`);
        for (let attempt = 0; attempt < 20 && !ids.kit; attempt += 1) {
          const kit = await json(await api.get(`${BASE}/api/user-schools/${mine[0].id}/kit`));
          if (kit?.kitId) {
            ids.unlocked = mine[0].id;
            ids.kit = kit.kitId;
          } else await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else
        note(
          `checkout session failed (${session.status()}): ${JSON.stringify(body).slice(0, 160)}`,
        );
    }
    ids.school = mine.find((s) => s.id !== ids.unlocked)?.id ?? mine[0]?.id;

    if (ids.kit) {
      // Give generation (replay AI) a moment, then take the first deliverable that exists.
      for (let attempt = 0; attempt < 30 && !ids.deliverable; attempt += 1) {
        const kit = await json(await api.get(`${BASE}/api/kits/${ids.kit}`));
        const list = kit?.deliverables ?? kit?.kit?.deliverables ?? [];
        ids.deliverable = (list.find((d) => d.status && d.status !== "pending") ?? list[0])?.id;
        if (!ids.deliverable) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      note(
        ids.deliverable
          ? "kit: unlocked, a deliverable exists"
          : "kit: unlocked, but no deliverable was generated locally",
      );
    } else note("kit: could not unlock a school locally");
  } catch (error) {
    note(`school setup stopped: ${String(error?.message ?? error).slice(0, 160)}`);
  }

  try {
    const page = await json(await api.get(`${BASE}/api/recommenders`));
    const existing = page?.recommenders ?? page?.items ?? [];
    ids.recommender = existing[0]?.id;
    if (!ids.recommender) {
      const created = await api.post(`${BASE}/api/recommenders`, {
        data: {
          name: "Dana Whitlock",
          email: "dana.whitlock@example.test",
          title: "Director of Clinical Systems",
          organisation: "Harbour Regional Health (fictional)",
          relationship: "manager",
          userSchoolIds: ids.school ? [ids.unlocked ?? ids.school] : [],
        },
        headers: { "Idempotency-Key": "shots-recommender-1" },
      });
      const body = await json(created);
      ids.recommender = body?.recommender?.id ?? body?.id;
      if (!ids.recommender)
        note(`add recommender failed (${created.status()}): ${JSON.stringify(body).slice(0, 200)}`);
    }
    if (ids.recommender) note("recommender: one fictional recommender on file");
  } catch (error) {
    note(`recommender setup stopped: ${String(error?.message ?? error).slice(0, 160)}`);
  }
  return ids;
}

// ---------------------------------------------------------------------------------------------

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const health = await fetch(`${BASE}/api/health`)
    .then((r) => r.json())
    .catch(() => null);
  if (!health?.ok) {
    console.error(
      `${BASE} isn't answering /api/health. Start the app first (docs/design/redesign/local-db.md).`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ channel: "chrome" });
  const desktop = await browser.newContext(contextOptions(DESKTOP, false));
  await setTheme(desktop);
  let phone = await browser.newContext(contextOptions(PHONE, true));
  await setTheme(phone);

  console.log(`Public routes → shots/${OUT}/ (${THEME}${REDUCED ? ", reduced motion" : ""})`);
  if (!APP_ONLY)
    for (const route of PUBLIC_ROUTES)
      if (wanted(route.name)) await capture({ desktop, phone }, route, {});

  if (!PUBLIC_ONLY) {
    console.log("Signing in");
    await signIn(desktop);
    const ids = await prepare(desktop);
    report.ids = ids;
    // The phone context shares the session.
    await phone.close();
    phone = await browser.newContext({
      ...contextOptions(PHONE, true),
      storageState: await desktop.storageState(),
    });
    await setTheme(phone);
    console.log("Signed-in routes");
    for (const route of [...APP_ROUTES, ...REFERENCE_ROUTES])
      if (wanted(route.name)) await capture({ desktop, phone }, route, ids);
  }

  await browser.close();
  report.takenAt = new Date().toISOString();
  const reportFile = join(SHOTS, `report${SUFFIX}.json`);
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  const overflowing = report.routes.filter((r) => r.overflow375?.px > 0).map((r) => r.name);
  const noisy = report.routes.filter((r) => r.consoleErrors.length > 0).map((r) => r.name);
  console.log(
    `\n${report.routes.length} routes. Overflow at 375: ${overflowing.join(", ") || "none"}.`,
  );
  console.log(
    `Console errors on: ${noisy.join(", ") || "none"}. Report: ${reportFile.replace(REPO, "")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
