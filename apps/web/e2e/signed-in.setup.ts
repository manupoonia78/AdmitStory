import { test as setup } from "@playwright/test";
import { AUTH_STATE } from "./support/paths";
import { signUpNewUser } from "./support/auth";

// One signed-in, welcomed account shared by the specs that only need "a signed-in user"
// (keyboard, theme, mobile, axe). Specs that test sign-in itself create their own accounts.
setup("sign up a shared test user", async ({ page }) => {
  await signUpNewUser(page);
  await page.context().storageState({ path: AUTH_STATE });
});
