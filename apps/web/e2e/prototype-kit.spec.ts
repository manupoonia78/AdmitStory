import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";

// The kit assembly prototype (spec §6.7 Kit generation, §6.10 screen F, §16 Phase 0.5). The run
// is scripted on a clock; ?at=<ms> starts part-way through, and ?at=40000 is the finished kit.

const PATH = "/prototype/kit";
const FINISHED = `${PATH}?at=40000`;

const STORY_FOR: Record<string, string> = {
  "Essay 1": "The night-shift fix",
  "Essay 2": "Eight people in a park",
  "Essay 3": "The vendor who said no",
  "Short answer": "My grandmother’s ledger",
  "Goal statement": "The night-shift fix",
};

test.describe("kit assembly prototype", () => {
  test("shows the Voiceprint, the stories and the school's deliverables", async ({ page }) => {
    await page.goto(PATH);
    await expect(
      page.getByRole("heading", { level: 1, name: "Northfield School of Management 2026–27 kit" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "Your Voiceprint" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your stories" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What Northfield asks for" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Replay" })).toBeVisible();
  });

  test("says in words which story went to which essay, without the animation", async ({ page }) => {
    await page.goto(FINISHED);
    const deliverables = page.getByRole("region", { name: "What Northfield asks for" });
    for (const [title, story] of Object.entries(STORY_FOR)) {
      const row = deliverables.getByRole("listitem").filter({
        has: page.getByRole("heading", { level: 3, name: title, exact: true }),
      });
      await expect(row).toContainText(`From your story ${story}`);
      await expect(row).toContainText("Draft ready");
    }
  });

  test("draws one thread per deliverable on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(FINISHED);
    await expect(page.locator("[data-thread]")).toHaveCount(Object.keys(STORY_FOR).length);
    // Threads are decoration; the rows above carry the meaning.
    await expect(page.locator("svg:has([data-thread])")).toHaveAttribute("aria-hidden", "true");
  });

  test("lists every stage with its status, and offers finished output", async ({ page }) => {
    await page.goto(FINISHED);
    const done = page.locator('ol > li[data-status="done"]');
    await expect(done).toHaveCount(5);
    // Status is a word for screen readers as well as an icon.
    await expect(done.first()).toContainText("Done: Positioning");
    await page.getByRole("button", { name: "Read it now: File map" }).click();
    const drawer = page.getByRole("dialog", { name: "File map" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("From your story The night-shift fix");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("streams the run and replays it from the start", async ({ page }) => {
    await page.goto(`${PATH}?at=13000`);
    // The stage list shows it; a polite live region repeats it for screen readers.
    await expect(
      page.getByText("Drafting Essay 1 from your story about the night-shift fix").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(page.getByText(/Scripted run, [0-2] of 40 seconds/)).toBeVisible();
    await expect(page.getByText("Choosing a story").first()).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });

  test("offers gap questions in a calm side plane", async ({ page }) => {
    await page.goto(FINISHED);
    const plane = page.getByRole("region", {
      name: "While you wait: 4 quick questions would make these drafts stronger.",
    });
    await expect(plane.getByRole("button", { name: "Answer by voice" })).toBeVisible();
    await expect(plane.getByRole("button", { name: "Skip, draft with gaps" })).toBeVisible();
    await plane.getByRole("button", { name: "Type answers" }).click();
    await plane
      .getByRole("textbox", { name: "How many people come to the park on a Saturday now?" })
      .fill("About thirty, most weeks.");
    await plane.getByRole("button", { name: "Save answers" }).click();
    await expect(plane).toContainText("Answers saved. The drafts will use them.");
  });

  test("goes still with reduced motion: threads fade in place", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(FINISHED);
    await expect(page.locator("[data-motion]")).toHaveAttribute("data-motion", "still");
    await expect(page.locator("[data-thread]")).toHaveCount(Object.keys(STORY_FOR).length);
    await expect(page.getByText("From your story The night-shift fix").first()).toBeVisible();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no axe violations mid-run and finished, with a ${colorScheme} system`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(`${PATH}?at=16000`);
      await page.getByRole("button", { name: "Pause" }).click();
      await expectNoAxeViolations(page);
      await page.goto(FINISHED);
      await expectNoAxeViolations(page);
    });
  }
});
