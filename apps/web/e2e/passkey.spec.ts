import { expect, test, type CDPSession } from "@playwright/test";
import { signOut, signUpNewUser } from "./support/auth";

// A CDP virtual authenticator stands in for Touch ID / Windows Hello: a platform authenticator
// with resident keys and user verification that approves every ceremony automatically.
async function addVirtualAuthenticator(cdp: CDPSession) {
  await cdp.send("WebAuthn.enable");
  return cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

test("add a passkey in settings, then sign in with it", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const { authenticatorId } = await addVirtualAuthenticator(cdp);

  await signUpNewUser(page);

  await test.step("add a passkey on /settings/security", async () => {
    await page.goto("/settings/security");
    await expect(page.getByRole("heading", { level: 1, name: "Passkeys" })).toBeVisible();
    await expect(page.getByText("No passkeys yet.")).toBeVisible();
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(
      page.getByText("Passkey added. You can use it next time you sign in."),
    ).toBeVisible();
    const list = page.getByRole("list", { name: "Passkeys on your account" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list).toContainText(/Passkey on /);
    const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
    expect(credentials).toHaveLength(1);
  });

  await test.step("rename it", async () => {
    await page.getByRole("button", { name: /^Rename / }).click();
    const dialog = page.getByRole("dialog", { name: "Rename passkey" });
    await dialog.getByLabel("Name").fill("Test laptop");
    await dialog.getByRole("button", { name: "Save name" }).click();
    await expect(dialog).toBeHidden();
    // The toast repeats the button's verb (spec §6.7).
    await expect(page.getByText("Name saved", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Rename Test laptop" })).toBeFocused();
    await expect(page.getByRole("list", { name: "Passkeys on your account" })).toContainText(
      "Test laptop",
    );
  });

  await test.step("signed out, the browser offers the passkey in the email field's autofill", async () => {
    // The virtual authenticator answers the conditional (autofill) request at once, standing in
    // for a person picking the passkey from the autofill list.
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  });

  await test.step("sign out, then 'Sign in with a passkey' lands on Home", async () => {
    // Turn autofill off in this document so only the button can start the ceremony.
    const noAutofill = () => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    };
    await page.addInitScript(noAutofill);
    await page.evaluate(noAutofill);
    await signOut(page);
    await page.getByRole("button", { name: "Sign in with a passkey" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  });

  await test.step("remove it", async () => {
    await page.goto("/settings/security");
    await page.getByRole("button", { name: "Remove Test laptop" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove this passkey?" });
    await dialog.getByRole("button", { name: "Remove passkey" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("No passkeys yet.")).toBeVisible();
  });
});
