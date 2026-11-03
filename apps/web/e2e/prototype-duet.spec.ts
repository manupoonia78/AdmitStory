import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";

// The live mock prototype (spec §6.7 "Live mock", §6.10 J, §16 Phase 0.5): two Voiceprints, a
// scripted interviewer and sample answers from a fictional applicant at a fictional school.

const PATH = "/prototype/duet";
const FIRST_QUESTION =
  "Thanks for making the time. Walk me through how you got from engineering to an MBA.";
const CONTROLS = ["Mute", "Captions on", "Pause", "Need a moment", "End"];

const timer = (page: Page) => page.getByRole("timer");
const controls = (page: Page) => page.getByRole("group", { name: "Mock controls" });

async function startMock(page: Page) {
  await page.getByRole("button", { name: "Start the mock" }).click();
  await expect(controls(page)).toBeVisible();
}

test.describe("Live mock prototype", () => {
  test("shows the room: session line, both Voiceprints and a way in", async ({ page }) => {
    await page.goto(PATH);
    const stage = page.getByRole("region", { name: "Live mock" });
    await expect(stage.getByRole("heading", { level: 1, name: "Northfield mock" })).toBeVisible();
    const details = stage.getByRole("list", { name: "About this mock" }).getByRole("listitem");
    await expect(details).toHaveText(["Admissions officer", "File-read", "30 min"]);
    await expect(timer(page)).toHaveText("00:00");
    await expect(stage.getByRole("img", { name: "Your Voiceprint" })).toBeVisible();
    await expect(stage.getByRole("img", { name: "The interviewer's Voiceprint" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start the mock" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start with my microphone" })).toBeVisible();
  });

  test("runs the mock: only the five controls, captions, a running timer, each form answering", async ({
    page,
  }) => {
    await page.goto(PATH);
    await startMock(page);

    const buttons = controls(page).getByRole("button");
    await expect(buttons).toHaveText(CONTROLS);
    // Focus moves into the room when the mock starts.
    await expect(controls(page).getByRole("button", { name: "Mute" })).toBeFocused();
    await expect(controls(page).getByRole("button", { name: "Captions on" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(page.locator("[data-party=interviewer]")).toHaveAttribute("data-mood", "speaking");
    await expect(page.locator("[data-party=you]")).toHaveAttribute("data-mood", "listening");
    await expect(
      page.getByRole("status").filter({ hasText: `Interviewer: ${FIRST_QUESTION}` }),
    ).toBeAttached();
    await expect(timer(page)).not.toHaveText("00:00");

    // Your sample answer follows, and the forms swap roles.
    await expect(page.locator("[data-party=you]")).toHaveAttribute("data-mood", "speaking", {
      timeout: 20_000,
    });
    await expect(page.locator("[data-party=interviewer]")).toHaveAttribute(
      "data-mood",
      "listening",
    );
  });

  test("works from the keyboard: pause stops the clock, captions hide, End finishes", async ({
    page,
  }) => {
    await page.goto(PATH);
    await page.getByRole("button", { name: "Start the mock" }).focus();
    await page.keyboard.press("Enter");
    const mute = controls(page).getByRole("button", { name: "Mute" });
    await expect(mute).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(controls(page).getByRole("button", { name: "Captions on" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-captions]")).toHaveAttribute("data-captions", "off");

    await page.keyboard.press("Tab");
    const pause = controls(page).getByRole("button", { name: "Pause" });
    await expect(pause).toBeFocused();
    await expect(timer(page)).not.toHaveText("00:00");
    await page.keyboard.press("Space");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Paused. The timer has stopped.")).toBeAttached();
    const frozen = await timer(page).textContent();
    await page.waitForTimeout(1500);
    await expect(timer(page)).toHaveText(frozen ?? "");
    await expect(page.locator("[data-party=you]")).toHaveAttribute("data-mood", "idle");
    await expect(page.locator("[data-party=interviewer]")).toHaveAttribute("data-mood", "idle");
    await page.keyboard.press("Space");
    await expect(pause).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Tab");
    const moment = controls(page).getByRole("button", { name: "Need a moment" });
    await expect(moment).toBeFocused();
    await page.keyboard.press("Space");
    await expect(moment).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText("Take your time. The interviewer will wait until you're ready.").last(),
    ).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(controls(page).getByRole("button", { name: "End" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Mock ended at \d\d:\d\d/).last()).toBeVisible();
    await expect(page.getByRole("button", { name: "Start again" })).toBeFocused();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no axe violations with a ${colorScheme} system, before and during the mock`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(PATH);
      await expectNoAxeViolations(page);
      await startMock(page);
      await expectNoAxeViolations(page);
    });
  }

  test("has no axe violations in Day", async ({ page }) => {
    await page.goto(PATH);
    await page.getByRole("radio", { name: "Day" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
    await startMock(page);
    await expectNoAxeViolations(page);
  });

  test("with reduced motion, the forms stay still and captions arrive whole", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH);
    await startMock(page);
    const interviewer = page.locator("[data-party=interviewer]");
    await expect(interviewer).toHaveAttribute("data-mood", "speaking");

    // No word is held back: the whole question is on screen at once.
    const caption = page.locator("[data-captions] p").first();
    await expect(caption.locator("[data-spoken]").first()).toBeVisible();
    await expect(caption.locator("[aria-hidden=true] > span:not([data-spoken])")).toHaveCount(0);

    // Nobody comes forward: the speaker's form keeps the listener's size.
    const you = page.locator("[data-party=you]");
    const [a, b] = await Promise.all([interviewer.boundingBox(), you.boundingBox()]);
    expect(Math.round(a?.width ?? 0)).toBe(Math.round(b?.width ?? 0));
    await expectNoAxeViolations(page);
  });
});
