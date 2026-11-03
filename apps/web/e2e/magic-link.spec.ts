import { expect, test } from "@playwright/test";
import { completeWelcome, requestMagicLink, signOut, waitForTurnstile } from "./support/auth";
import { expectNoAxeViolations } from "./support/axe";
import { clearOutboxFor, syntheticEmail, takeMagicLink } from "./support/outbox";

test("magic-link sign-in end to end, through the welcome gate, and sign out", async ({
  page,
  context,
}) => {
  const email = syntheticEmail();

  await test.step("request a link", async () => {
    await requestMagicLink(page, email);
  });

  const link = await test.step("send the link again and use the newest one", async () => {
    const before = new Date();
    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Send the link again" }).click();
    await expect(page.getByText("We sent another link. Use the newest one.")).toBeVisible();
    const newest = await takeMagicLink(email, before);
    await clearOutboxFor(email);
    return newest;
  });

  await test.step("change email goes back to the form, focused and filled in", async () => {
    await page.getByRole("button", { name: "Use a different email" }).click();
    const field = page.getByLabel("Email address");
    await expect(field).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(email);
  });

  await test.step("a new account lands on the welcome gate", async () => {
    await page.goto(link);
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("heading", { level: 1, name: "Before you start" })).toBeVisible();
  });

  await test.step("the welcome gate holds every signed-in page", async () => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/welcome$/);
  });

  await test.step("the welcome page passes axe in light and dark", async () => {
    // Reload after each switch so axe never samples a colour mid-transition.
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Before you start" })).toBeVisible();
      await expectNoAxeViolations(page);
    }
  });

  await test.step("both boxes are needed, and a failed submit keeps what was ticked", async () => {
    const age = page.getByLabel("I'm 18 or older.");
    const terms = page.getByLabel("I agree to these commitments.");
    await age.check();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await expect(page.getByText("Agree to these commitments to continue.")).toBeVisible();
    await expect(page).toHaveURL(/\/welcome$/);
    // React resets an action form after it runs; the ticked box must survive that.
    await expect(age).toBeChecked();
    // Focus moves to the box that still needs ticking, which reads its error.
    await expect(terms).toBeFocused();
    await expect(terms).toHaveAttribute("aria-invalid", "true");
    await expect(terms).toHaveAccessibleDescription("Agree to these commitments to continue.");

    // The other way round: only the commitments ticked.
    await terms.check();
    await age.uncheck();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await expect(page.getByText("Confirm that you're 18 or older to continue.")).toBeVisible();
    await expect(terms).toBeChecked();
    await expect(age).toBeFocused();
  });

  await test.step("confirming 18+ and the commitments opens Home in the shell", async () => {
    await completeWelcome(page);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your story starts here" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    // The gate stays open once passed.
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/home$/);
  });

  await test.step("sign out returns to sign-in and ends the session", async () => {
    await signOut(page);
    await page.goto("/home");
    await expect(page).toHaveURL(/\/sign-in$/);
    expect((await context.cookies()).some((c) => c.name.includes("session_token") && c.value)).toBe(
      false,
    );
  });

  await test.step("a used link can't sign in again", async () => {
    await page.goto(link);
    await expect(page).toHaveURL(/\/sign-in\?error=INVALID_TOKEN$/);
    await expect(page.getByText("That sign-in link has expired")).toBeVisible();
  });
});
