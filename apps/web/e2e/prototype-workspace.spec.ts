import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";

// The Workspace prototype (spec §5.8, §6.7 "Your words, lit", §6.10 screen G, §16 Phase 0.5):
// the your-words glow with its sources, a NEED chip, and a Refine change that morphs in place.

const PATH = "/prototype/workspace";
const REFINE_MESSAGE = "Paragraph 2 rewritten. Review the change.";

const toggle = (page: Page) => page.getByRole("switch", { name: "Your words" });
const view = (page: Page) => page.locator("[data-your-words]");
const lit = (page: Page) => page.locator("[data-own-words]");
const paragraph = (page: Page, id: string) => page.locator(`[data-paragraph="${id}"]`);

/**
 * Turns the your-words view on with its shortcut. The essay machinery is split out of the route's
 * first load (page.tsx, spec §6.11), so the server-rendered screen is on-screen a moment before
 * the shortcut starts listening and a press sent in that window is lost. Press until the switch
 * answers; what the shortcut does is asserted on its own in "Y toggles the your-words view".
 */
async function turnOnYourWords(page: Page) {
  await expect(async () => {
    await page.keyboard.press("y");
    await expect(toggle(page)).toHaveAttribute("aria-checked", "true", { timeout: 500 });
  }).toPass();
}

async function askForMoreSpecific(page: Page) {
  await page.getByRole("tab", { name: "Refine" }).click();
  await page.getByRole("button", { name: "More specific" }).click();
}

test.describe("workspace prototype", () => {
  test("lays out Files, the essay and the Coach at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PATH);
    await expect(page.getByRole("navigation", { name: "Northfield 2026–27" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Essay 1" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Coach" })).toBeVisible();
    await expect(page.getByText("187 / 200 words").first()).toBeVisible();
    await expect(
      page.getByText(/Tell us about a time you took responsibility/).first(),
    ).toBeVisible();

    // Essays are set in the reading face, 19/32, within 70 characters.
    const text = page.locator("[data-your-words]");
    await expect(text).toHaveCSS("font-size", "19px");
    await expect(text).toHaveCSS("line-height", "32px");
    expect((await text.boundingBox())?.width).toBeLessThanOrEqual(720);
  });

  test("Y toggles the your-words view, but not while typing", async ({ page }) => {
    await page.goto(PATH);
    await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
    await expect(lit(page)).toHaveCount(0);

    await turnOnYourWords(page);
    await expect(view(page)).toHaveAttribute("data-your-words", "on");
    // Eight verbatim or adapted sentences glow; the composed ones stay plain.
    await expect(lit(page)).toHaveCount(8);
    await expect(page.locator('[data-kind="composed"][data-own-words]')).toHaveCount(0);
    await expect(page.getByText("Lit sentences").first()).toBeVisible();

    await page.getByRole("tab", { name: "Refine" }).click();
    // Real key presses, so the Y in the request reaches the shortcut listener.
    await page.getByRole("textbox", { name: "Ask for a change" }).click();
    await page.keyboard.type("say why");
    await expect(toggle(page)).toHaveAttribute("aria-checked", "true");

    await page.locator("body").click({ position: { x: 4, y: 200 } });
    await page.keyboard.press("y");
    await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  });

  test("shows the moment you said it on focus and hover, and Escape hides it", async ({ page }) => {
    await page.goto(PATH);
    await turnOnYourWords(page);
    const first = lit(page).first();
    await expect(first).toHaveAttribute("role", "button");
    await expect(first).toHaveAttribute("tabindex", "0");

    await first.focus();
    const popover = page.locator("[data-source-popover]");
    await expect(popover).toContainText("The moment you said it");
    await expect(popover).toContainText("Story Studio, session 2, 14 minutes in");
    await expect(popover).toContainText("I just sat there counting them");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);

    await lit(page).nth(2).hover();
    await expect(popover).toContainText("I couldn’t tell the vendor or the nurses");
  });

  test("keeps a refined paragraph with A, and undoes it with R", async ({ page }) => {
    await page.goto(PATH);
    await askForMoreSpecific(page);
    const bar = page.getByRole("group", { name: REFINE_MESSAGE });
    await expect(bar).toBeFocused();
    await expect(page.getByRole("button", { name: "Keep change" })).toBeVisible();

    await page.keyboard.press("a");
    await expect(page.getByText("Change kept in paragraph 2.")).toBeVisible();
    await expect(paragraph(page, "p2").locator("[data-decision]")).toHaveCount(0);
    await expect(paragraph(page, "p2")).toContainText(
      "At 2:15 I called the vendor’s on-call engineer",
    );
    await expect(page.getByText("193 / 200 words").first()).toBeVisible();

    await page.keyboard.press("r");
    await expect(page.getByRole("group", { name: /Change kept|rewritten|undone/ })).toHaveCount(0);
    await expect(paragraph(page, "p2")).toContainText(
      "kept them both on one line until we found it.",
    );
    await expect(paragraph(page, "p2")).not.toContainText("At 2:15");
    await expect(page.getByText("187 / 200 words").first()).toBeVisible();
  });

  test("answers a NEED chip in place, and says when the essay runs over", async ({ page }) => {
    await page.goto(PATH);
    await page
      .getByRole("button", {
        name: "Needs you: What did your manager say when you told him? About 20 words.",
      })
      .click();
    const answer = page.getByRole("textbox", {
      name: "What did your manager say when you told him?",
    });
    await expect(answer).toBeFocused();
    // Typing in the composer never fires the single-letter shortcuts.
    await answer.fill(
      "He laughed, said he would never have found it, and asked me to teach the whole day shift by Friday.",
    );
    await page.getByRole("button", { name: "Add to draft" }).click();

    await expect(paragraph(page, "p3")).toContainText("He laughed, said he would never");
    await expect(page.getByText("207 / 200 words").first()).toBeVisible();
    await expect(page.getByText("7 words over").first()).toBeVisible();
    await page.keyboard.press("y");
    await expect(lit(page)).toHaveCount(9);
  });

  test("opens the Coach as a sheet below 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto(PATH);
    await expect(page.getByRole("complementary", { name: "Coach" })).toBeHidden();
    await page.getByRole("button", { name: "Open coach" }).click();
    const sheet = page.getByRole("dialog", { name: "Coach" });
    await expect(sheet).toBeVisible();
    await askForMoreSpecific(page);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("group", { name: REFINE_MESSAGE })).toBeFocused();
  });

  test("switches between Files, Essay and Coach views on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    const views = page.getByRole("group", { name: "Views" });
    await expect(views.getByRole("button", { name: "Essay" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await views.getByRole("button", { name: "Coach" }).click();
    await expect(page.getByRole("heading", { name: "Why this draft" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Essay 1" })).toBeHidden();

    // A change requested in the Coach brings the essay back to review it.
    await askForMoreSpecific(page);
    await expect(page.getByRole("group", { name: REFINE_MESSAGE })).toBeVisible();
    await expect(views.getByRole("button", { name: "Essay" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("reduced motion: the glow appears without animating and the change swaps at once", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH);
    await turnOnYourWords(page);
    await expect(lit(page).first()).toHaveCSS("transition-property", "none");

    await askForMoreSpecific(page);
    await page.getByRole("button", { name: "Keep change" }).click();
    await expect(paragraph(page, "p2").locator("[data-decision]")).toHaveCount(0, {
      timeout: 1_000,
    });
    await expect(paragraph(page, "p2")).toContainText("At 2:15");
  });

  test("the glow becomes a dotted underline in forced colours", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto(PATH);
    await turnOnYourWords(page);
    const first = lit(page).first();
    await expect(first).toHaveCSS("text-decoration-line", "underline");
    await expect(first).toHaveCSS("text-decoration-style", "dotted");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no axe violations with a ${colorScheme} system`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(PATH);
      await expectNoAxeViolations(page);

      // The lit view with a source showing, and a change under review.
      // Each check waits for the popover's 120 ms fade to finish, so axe measures its settled
      // colours rather than text half-way through fading in or out.
      const popover = page.locator("[data-source-popover]");
      await page.keyboard.press("y");
      await lit(page).first().focus();
      await expect(popover).toHaveCSS("opacity", "1");
      await expectNoAxeViolations(page);
      await askForMoreSpecific(page);
      await expect(page.getByRole("group", { name: REFINE_MESSAGE })).toBeFocused();
      await expect(popover).toHaveCount(0);
      await expectNoAxeViolations(page);
    });
  }
});
