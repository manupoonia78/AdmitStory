import { test } from "@playwright/test";
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
