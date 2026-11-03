import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  for (const path of ["/home", "/settings/security", "/welcome", "/"]) {
    test(`${path} redirects to /sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Sign in or create your account" }),
      ).toBeVisible();
    });
  }

  test("sign-in offers email and passkeys, and no password field", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
    // Google is hidden unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(
      process.env.GOOGLE_CLIENT_ID ? 1 : 0,
    );
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("an expired or used link explains what to do", async ({ page }) => {
    await page.goto("/sign-in?error=INVALID_TOKEN");
    await expect(page.getByText("That sign-in link has expired")).toBeVisible();
    await expect(page.getByText(/Links work once, for 10 minutes/)).toBeVisible();
  });

  test("a mistyped email is caught before sending", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("name@example");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    const field = page.getByLabel("Email address");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText("Enter an email address in the format name@example.com."),
    ).toBeVisible();
    // Focus goes back to the field, so its label, state and error are read together.
    await expect(field).toBeFocused();
    await expect(field).toHaveAccessibleDescription(
      "Enter an email address in the format name@example.com.",
    );
  });

  test("live regions stay in the accessibility tree before anything is said", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email address")).toBeVisible();
    // The form's alert region exists while empty, and is not display: none.
    const alerts = page.locator('form [role="alert"]');
    await expect(alerts).toHaveCount(1);
    await expect(alerts).toBeEmpty();
    for (const region of await alerts.all()) {
      expect(await region.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
    }
  });
});
