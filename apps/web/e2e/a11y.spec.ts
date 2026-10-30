import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";
import { AUTH_STATE } from "./support/paths";

// /welcome is checked in magic-link.spec.ts, the one place a not-yet-welcomed account exists.
const SCHEMES = ["light", "dark"] as const;

test.describe("axe, signed out", () => {
  for (const colorScheme of SCHEMES) {
    test(`/sign-in in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/sign-in");
      await expectNoAxeViolations(page);
    });
  }
});

test.describe("axe, signed in", () => {
  test.use({ storageState: AUTH_STATE });
  for (const path of ["/home", "/settings", "/settings/security"]) {
    for (const colorScheme of SCHEMES) {
      test(`${path} in ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await expectNoAxeViolations(page);
      });
    }
  }
});

// The shell's own surfaces (spec §6.5): the open dock, the command palette, and the bottom dock
// on a phone, in both themes.
test.describe("axe, signed-in shell", () => {
  test.use({ storageState: AUTH_STATE });
  for (const colorScheme of SCHEMES) {
    test(`the dock opened by keyboard focus, in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/home");
      const nav = page.getByRole("navigation", { name: "Main" });
      await nav.getByRole("link", { name: "Home" }).focus();
      // Measure the open dock, not its labels half-way through fading in.
      const label = nav.getByRole("link", { name: "Schools" }).locator("span").last();
      await expect.poll(() => label.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      await expectNoAxeViolations(page);
    });

    test(`the command palette, in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/home");
      await page.keyboard.press("Control+k");
      await expect(page.getByRole("dialog", { name: "Search or jump to…" })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }

  test.describe("phone (390 × 844)", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    for (const colorScheme of SCHEMES) {
      test(`the bottom dock and top bar, in ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto("/home");
        await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
        await expectNoAxeViolations(page);
      });
    }
  });
});
