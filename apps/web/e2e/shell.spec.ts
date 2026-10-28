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

  test("every rail link is reachable with Tab and the current page is marked", async ({ page }) => {
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

    // Enter on a focused rail link navigates.
    await nav.getByRole("link", { name: "Tracker" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tracker$/);
    await expect(nav.getByRole("link", { name: "Tracker" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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
// --mist in each mode (packages/ui THEME_COLORS).
const MIST = { light: "#f2f4f8", dark: "#0e1322" };

test("theme: choosing Dark sets data-theme and survives a reload", async ({ page }) => {
  await page.goto("/settings");
  const html = page.locator("html");
  expect(await themeColors(page)).toEqual({ [LIGHT]: MIST.light, [DARK]: MIST.dark });

  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  // The browser chrome follows the manual choice whatever the OS is set to.
  await expect.poll(() => themeColors(page)).toEqual({ [LIGHT]: MIST.dark, [DARK]: MIST.dark });
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(await themeColors(page)).toEqual({ [LIGHT]: MIST.dark, [DARK]: MIST.dark });

  await page.getByRole("radio", { name: "Match system" }).click();
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  await expect.poll(() => themeColors(page)).toEqual({ [LIGHT]: MIST.light, [DARK]: MIST.dark });
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  expect(await themeColors(page)).toEqual({ [LIGHT]: MIST.light, [DARK]: MIST.dark });
});

test.describe("mobile (390 × 844)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the bottom tab bar shows the six destinations", async ({ page }) => {
    await page.goto("/home");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(6);
    for (const { label } of DESTINATIONS)
      await expect(nav.getByRole("link", { name: label })).toBeVisible();

    const box = await nav.boundingBox();
    expect(box && box.y + box.height).toBeCloseTo(844, -1);
    for (const link of await links.all()) {
      const linkBox = await link.boundingBox();
      expect(linkBox?.height).toBeGreaterThanOrEqual(44);
    }
    // No horizontal scrolling.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});

test.describe("wide but short (844 × 390, a phone held sideways)", () => {
  // Signed out to start with: the test signs up its own account (see below).
  test.use({ viewport: { width: 844, height: 390 }, storageState: { cookies: [], origins: [] } });

  test("the rail's Account trigger can be reached, and Sign out works from it", async ({
    page,
  }) => {
    // A fresh account: signing out ends its session, which the shared one must keep.
    await signUpNewUser(page);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

    const account = page.getByRole("button", { name: "Account" });
    // From 640px up the left rail is shown; on a short screen its last item must still be reachable.
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
