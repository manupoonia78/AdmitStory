import { expect, test, type Page } from "@playwright/test";
import { signUpNewUser } from "./support/auth";
import { AUTH_STATE } from "./support/paths";

test.use({ storageState: AUTH_STATE });

const DESTINATIONS = [
  { label: "Home", href: "/home" },
  { label: "Story", href: "/studio" },
  { label: "Schools", href: "/schools" },
  { label: "Interview", href: "/interview" },
  { label: "Connect", href: "/connect" },
  { label: "Tracker", href: "/tracker" },
];

test.describe("keyboard only", () => {
  test("the skip link comes first and moves focus to main", async ({ page }) => {
    await page.goto("/home");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("every dock link is reachable with Tab and the current page is marked", async ({ page }) => {
    await page.goto("/schools");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Schools" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    const reached = new Set<string>();
    for (let i = 0; i < 20 && reached.size < DESTINATIONS.length; i += 1) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(() =>
        document.activeElement?.closest('nav[aria-label="Main"] a')?.getAttribute("href"),
      );
      if (href) reached.add(href);
    }
    expect([...reached].sort()).toEqual(DESTINATIONS.map((d) => d.href).sort());

    // Enter on a focused dock link navigates.
    await nav.getByRole("link", { name: "Tracker" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tracker$/);
    await expect(nav.getByRole("link", { name: "Tracker" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("keyboard focus opens the dock and shows every label; Escape folds it away", async ({
    page,
  }) => {
    await page.goto("/home");
    const dock = page.locator('[data-slot="dock"]');
    const label = dock.getByRole("link", { name: "Schools" }).locator("span").last();
    await expect.poll(() => label.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");

    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // search, the first item in the dock
    await expect(dock.getByRole("button", { name: "Search or jump to…" })).toBeFocused();
    await expect.poll(() => label.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await expect.poll(async () => (await dock.boundingBox())?.width).toBeGreaterThan(200);

    await page.keyboard.press("Escape");
    await expect(dock).toHaveAttribute("data-folded", "");
    await expect.poll(() => label.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    await expect.poll(async () => (await dock.boundingBox())?.width).toBeLessThan(70);
  });

  test("dock navigation runs a view transition and the dock stays put", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __viewTransitions: number };
      w.__viewTransitions = 0;
      const original = document.startViewTransition?.bind(document);
      if (!original) return;
      document.startViewTransition = ((arg: Parameters<typeof original>[0]) => {
        w.__viewTransitions += 1;
        return original(arg);
      }) as typeof document.startViewTransition;
    });
    await page.goto("/home");
    const dock = page.locator('[data-slot="dock"]');
    const before = await dock.boundingBox();
    await dock.getByRole("link", { name: "Tracker" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tracker" })).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __viewTransitions: number }).__viewTransitions,
      ),
    ).toBeGreaterThan(0);
    await page.mouse.move(800, 400); // off the dock, so it is closed again
    await expect.poll(async () => (await dock.boundingBox())?.x).toBe(before?.x);
  });

  test("Ctrl K opens the command palette and Enter goes to a destination", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Search or jump to…" });
    await expect(palette).toBeVisible();
    await page.keyboard.type("Interview");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/interview$/);
    await expect(palette).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Interview" })).toBeVisible();
  });

  test("the account menu opens from the keyboard", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("button", { name: "Account" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(page.getByRole("button", { name: "Account" })).toBeFocused();
  });
});

test.describe("placeholder pages", () => {
  for (const { label, href } of DESTINATIONS) {
    test(`${href} has its title as the headline and an honest empty state`, async ({ page }) => {
      await page.goto(href);
      const title = label === "Story" ? "Story Studio" : label;
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(`^${title} \\| `));
    });
  }
});

/** The content of each <meta name="theme-color">, keyed by its media query. */
async function themeColors(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => [
        meta.getAttribute("media") ?? "",
        meta.getAttribute("content"),
      ]),
    ),
  );
}

const LIGHT = "(prefers-color-scheme: light)";
const DARK = "(prefers-color-scheme: dark)";
// --space in each theme (packages/ui THEME_COLORS).
const SPACE = { day: "#f4f5fb", night: "#070a1f" };

test("theme: choosing Night sets data-theme and survives a reload", async ({ page }) => {
  await page.goto("/settings");
  const html = page.locator("html");
  expect(await themeColors(page)).toEqual({ [LIGHT]: SPACE.day, [DARK]: SPACE.night });

  await page.getByRole("radio", { name: "Night" }).click();
  await expect(html).toHaveAttribute("data-theme", "night");
  // The browser chrome follows the manual choice whatever the OS is set to.
  await expect.poll(() => themeColors(page)).toEqual({ [LIGHT]: SPACE.night, [DARK]: SPACE.night });
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "night");
  await expect(page.getByRole("radio", { name: "Night" })).toBeChecked();
  expect(await themeColors(page)).toEqual({ [LIGHT]: SPACE.night, [DARK]: SPACE.night });

  await page.getByRole("radio", { name: "Match system" }).click();
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  await expect.poll(() => themeColors(page)).toEqual({ [LIGHT]: SPACE.day, [DARK]: SPACE.night });
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  expect(await themeColors(page)).toEqual({ [LIGHT]: SPACE.day, [DARK]: SPACE.night });
});

test.describe("mobile (390 × 844)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the floating bottom dock shows the six destinations with their labels", async ({
    page,
  }) => {
    await page.goto("/home");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(6);
    for (const { label } of DESTINATIONS) {
      const link = nav.getByRole("link", { name: label });
      await expect(link).toBeVisible();
      // Labels are always visible on phones (opacity counts as visible to toBeVisible).
      await expect(link.getByText(label)).toHaveCSS("opacity", "1");
    }

    // Floating: it sits just above the bottom edge, inset from both sides.
    const box = await nav.boundingBox();
    expect(box && box.y + box.height).toBeGreaterThan(820);
    expect(box && box.y + box.height).toBeLessThan(844);
    expect(box?.x).toBeGreaterThan(0);
    for (const link of await links.all()) {
      const linkBox = await link.boundingBox();
      expect(linkBox?.height).toBeGreaterThanOrEqual(44);
    }
    // The account menu stays in the slim top bar.
    await expect(page.getByRole("button", { name: "Account" })).toBeInViewport();
    // No horizontal scrolling.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});

test.describe("wide but short (844 × 390, a phone held sideways)", () => {
  // Signed out to start with: the test signs up its own account (see below).
  test.use({ viewport: { width: 844, height: 390 }, storageState: { cookies: [], origins: [] } });

  test("the dock's Account trigger can be reached, and Sign out works from it", async ({
    page,
  }) => {
    // A fresh account: signing out ends its session, which the shared one must keep.
    await signUpNewUser(page);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

    const account = page.getByRole("button", { name: "Account" });
    // From 640px up the side dock is shown; on a short screen its last item must still be reachable.
    await account.focus();
    // Focus loads the real menu, whose trigger takes over from the placeholder (and its focus).
    await expect(account).toHaveAttribute("data-state", "closed");
    await expect(account).toBeFocused();
    await account.scrollIntoViewIfNeeded();
    await expect(account).toBeInViewport();

    await page.keyboard.press("Enter");
    const signOut = page.getByRole("menuitem", { name: "Sign out" });
    await expect(signOut).toBeInViewport();
    await signOut.click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/home");
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the dock opens at once and the veil jumps instead of gliding", async ({ page }) => {
    await page.goto("/home");
    const dock = page.locator('[data-slot="dock"]');
    await expect(dock).toHaveCSS("transition-property", "none");
    await dock.getByRole("link", { name: "Home" }).focus();
    // Labels still fade, over 120 ms.
    const label = dock.getByRole("link", { name: "Home" }).getByText("Home");
    await expect(label).toHaveCSS("transition-duration", "0.12s");
  });
});
