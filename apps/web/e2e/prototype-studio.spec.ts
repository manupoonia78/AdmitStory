import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";

// The Story Studio prototype (spec §5.2, §6.7, §6.10 B, §16 Phase 0.5). The sample answer plays a
// scripted, fictional answer with a synthetic voice, so no microphone is needed; the microphone
// itself is replaced in the page wherever it is asked for.

const PATH = "/prototype/studio";
const ANNOUNCEMENT = "New story added to your shelf: The night-shift fix.";
// The Work question is read aloud first (about 6 s), then the answer reaches the story (about 10 s).
const SAMPLE_TIMEOUT = 40_000;

async function refuseMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
      },
    });
  });
}

/** Records whether a flying card is ever added to the page. */
async function watchFlights(page: Page) {
  await page.evaluate(() => {
    const flags = window as unknown as { __flew?: boolean };
    flags.__flew = false;
    new MutationObserver(() => {
      if (document.querySelector("[data-flight]")) flags.__flew = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
}

const flew = (page: Page) =>
  page.evaluate(() => (window as unknown as { __flew?: boolean }).__flew ?? false);

test.describe("Story Studio prototype", () => {
  test("shows the Studio: chapters, question, Voiceprint, controls, shelf and coverage", async ({
    page,
  }) => {
    await page.goto(PATH);
    await expect(page.getByRole("heading", { level: 1, name: "Story Studio" })).toBeAttached();

    const tabs = page.getByRole("tablist", { name: "Chapters" }).getByRole("tab");
    await expect(tabs).toHaveCount(9);
    await expect(page.getByRole("tab", { name: "Work", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const panel = page.getByRole("tabpanel", { name: "Work" });
    await expect(
      panel.getByRole("heading", { level: 2, name: /You led the go-live with no manager/ }),
    ).toBeVisible();
    await expect(panel.getByRole("img", { name: "Your Voiceprint" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Record your answer" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    for (const name of ["Done", "Write instead", "Skip for now", "I'm short on time"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    const shelf = page.getByRole("complementary", { name: "Your stories" });
    await expect(shelf.getByRole("heading", { name: "Your shelf (8)" })).toBeVisible();
    await expect(shelf.getByText("58 facts captured")).toBeVisible();
    await expect(shelf.getByText("Leadership: partial — no originated idea yet")).toBeAttached();
  });

  test("plays the sample answer: the phrase ignites and flies to the shelf", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(PATH);
    await watchFlights(page);
    await page.getByRole("button", { name: "Play sample answer" }).click();
    await expect(page.getByRole("button", { name: "Stop sample answer" })).toBeVisible();

    // The transcript fills in phrase by phrase while the Voiceprint speaks.
    await expect(page.getByRole("log", { name: "Your answer" })).toContainText(
      "It was 2 a.m. on the second night of the go-live,",
      { timeout: SAMPLE_TIMEOUT },
    );
    await expect(page.locator("[data-ignited]")).toHaveCount(1, { timeout: SAMPLE_TIMEOUT });
    await expect(page.getByRole("status").filter({ hasText: ANNOUNCEMENT })).toBeAttached({
      timeout: SAMPLE_TIMEOUT,
    });
    expect(await flew(page)).toBe(true);

    const shelf = page.getByRole("complementary", { name: "Your stories" });
    await expect(shelf.getByRole("heading", { name: "Your shelf (9)" })).toBeVisible();
    await expect(shelf.getByRole("button", { name: "The night-shift fix" })).toBeVisible();
    await expect(shelf.getByText("61 facts captured")).toBeVisible();
    await expect(
      shelf.getByText("Leadership: strong — originated an idea under pressure"),
    ).toBeAttached();
    await expect(page.locator("[data-flight]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play sample answer" })).toBeVisible({
      timeout: SAMPLE_TIMEOUT,
    });
  });

  test("keeps the layout still while the question is read", async ({ page }) => {
    await page.goto(PATH);
    const voiceprint = page.getByRole("img", { name: "Your Voiceprint" });
    await expect(voiceprint).toBeVisible();
    const before = await voiceprint.boundingBox();
    await page.waitForTimeout(1500);
    expect(await voiceprint.boundingBox()).toEqual(before);
  });

  test("works from the keyboard: chapters, skipping and writing an answer", async ({ page }) => {
    await page.goto(PATH);
    const work = page.getByRole("tab", { name: "Work", exact: true });
    await work.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Education" })).toBeFocused();
    // Arrow keys only move focus; Enter opens the chapter.
    await expect(work).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 2, name: /Why did you choose what you studied/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Skip for now" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab", { name: "Work", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByText("Moved on to Work. You can come back to Education any time."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Write instead" }).focus();
    await page.keyboard.press("Enter");
    const answer = page.getByRole("textbox", { name: "Your answer" });
    await expect(answer).toBeFocused();
    await page.keyboard.type("I called the lab manager at home and we agreed on a fallback.");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Save answer" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Answer saved.")).toBeVisible();
    await expect(page.getByRole("log", { name: "Your answer" })).toContainText(
      "I called the lab manager at home",
    );
    await expect(page.getByText("59 facts captured")).toBeVisible();
  });

  test("explains the microphone before asking, and offers typing when it is blocked", async ({
    page,
  }) => {
    await refuseMicrophone(page);
    await page.goto(PATH);
    // Space to talk from anywhere outside a field or another control.
    await page.locator("body").click({ position: { x: 4, y: 200 } });
    await page.keyboard.press("Space");
    await expect(
      page.getByText(
        "AdmitStory needs your microphone to hear your answers. Audio is turned into text and not kept unless you choose to.",
      ),
    ).toBeVisible();
    const allow = page.getByRole("button", { name: "Allow microphone" });
    await expect(allow).toBeFocused();
    await allow.click();
    await expect(
      page.getByText(
        "Microphone is blocked in your browser settings. You can keep going by typing.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Write instead" }).first().click();
    await expect(page.getByRole("textbox", { name: "Your answer" })).toBeFocused();
  });

  test("says what short on time means", async ({ page }) => {
    await page.goto(PATH);
    const hurry = page.getByRole("button", { name: "I'm short on time" });
    await hurry.click();
    await expect(hurry).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/only the questions your schools need/)).toBeVisible();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no axe violations with a ${colorScheme} system`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(PATH);
      await expect(page.getByRole("img", { name: "Your Voiceprint" })).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }

  test("has no axe violations in Day", async ({ page }) => {
    await page.goto(PATH);
    await page.getByRole("radio", { name: "Day" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
    await expectNoAxeViolations(page);
  });

  test("with reduced motion, the story simply appears and the count updates", async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH);
    await watchFlights(page);
    await page.getByRole("button", { name: "Play sample answer" }).click();
    await expect(page.getByRole("status").filter({ hasText: ANNOUNCEMENT })).toBeAttached({
      timeout: SAMPLE_TIMEOUT,
    });
    await expect(page.getByRole("heading", { name: "Your shelf (9)" })).toBeVisible();
    expect(await flew(page)).toBe(false);
    await expect(page.locator("[data-ignited]")).toHaveCount(0);
    await expectNoAxeViolations(page);
  });
});
