import { expect, type Page } from "@playwright/test";
import { syntheticEmail, takeMagicLink } from "./outbox";

/**
 * Waits until Cloudflare's always-pass test widget has produced a token. Without Turnstile keys
 * (local development without them) the server doesn't ask for one and there is no widget.
 */
export async function waitForTurnstile(page: Page): Promise<void> {
  if (!process.env.TURNSTILE_SITE_KEY) return;
  await expect(page.locator('input[name="cf-turnstile-response"]').first()).toHaveValue(/.+/, {
    timeout: 30_000,
  });
}

/** Requests a sign-in link on /sign-in and waits for the "Check your email" state. */
export async function requestMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByText(`We sent a sign-in link to ${email}.`)).toBeVisible();
}

/** Confirms 18+ and the integrity commitments on /welcome, landing on /home. */
export async function completeWelcome(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel("I'm 18 or older.").check();
  await page.getByLabel("I agree to these commitments.").check();
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

/** A brand-new account, signed in by magic link and through the welcome gate, on /home. */
export async function signUpNewUser(page: Page): Promise<string> {
  const email = syntheticEmail();
  await requestMagicLink(page, email);
  await page.goto(await takeMagicLink(email));
  await completeWelcome(page);
  return email;
}

/** Signs out from the account menu and waits for /sign-in. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}
