import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";

// The Phase 0.5 prototype scaffold (spec §16). playwright.config.ts sets PROTOTYPES_ENABLED=1, so
// the routes exist under `next start`. Route content is checked in each prototype's own spec.

const ROUTES = ["studio", "kit", "workspace", "duet", "voiceprint", "transitions"];

test.describe("prototype index", () => {
  test("links every prototype under a display headline", async ({ page }) => {
    await page.goto("/prototype");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your voice becomes light" }),
    ).toBeVisible();
    const main = page.locator("main#main");
    for (const route of ROUTES) {
      await expect(main.locator(`a[href="/prototype/${route}"]`)).toHaveCount(1);
    }
    await expect(page.getByRole("link", { name: "AdmitStory prototypes" })).toHaveAttribute(
      "href",
      "/prototype",
    );
  });

  test("is Night on a light system, and steps aside when Day is chosen", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/prototype");
    const scope = page.locator("[data-immersive]");
    await expect(scope).toHaveAttribute("data-theme", "night");

    await page.getByRole("radio", { name: "Day" }).click();
    await expect(scope).not.toHaveAttribute("data-theme", /.+/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");

    await page.getByRole("radio", { name: "Match system" }).click();
    await expect(scope).toHaveAttribute("data-theme", "night");
  });

  test("shows the frame HUD only with ?hud=1", async ({ page }) => {
    await page.goto("/prototype");
    await expect(page.getByRole("complementary", { name: "Frame monitor" })).toHaveCount(0);
    await page.goto("/prototype?hud=1");
    const hud = page.getByRole("complementary", { name: "Frame monitor" });
    await expect(hud).toBeVisible();
    await expect(hud).toContainText(/\d+ fps/);
  });

  test("tells search engines not to index it", async ({ page }) => {
    await page.goto("/prototype");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no axe violations with a ${colorScheme} system`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/prototype");
      await expectNoAxeViolations(page);
    });
  }
});
