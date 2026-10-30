import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";

// Route transitions and shared-element flights between two sample pages (spec §6.6, §16 Phase
// 0.5). The stories are fictional (app/prototype/transitions/stories.ts).

const SHELF = "/prototype/transitions";
const STORY = { id: "night-shift-fix", title: "The night-shift fix" };

const shelfHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Your story shelf" });
const storyHeading = (page: Page) => page.getByRole("heading", { level: 1, name: STORY.title });
const card = (page: Page) => page.getByRole("link", { name: STORY.title });

/**
 * Records every view transition the page starts, with the duration of each animation the browser
 * runs on its pseudo-elements, so a test can tell a drift flight from a 120 ms fade.
 */
async function recordViewTransitions(page: Page) {
  await page.addInitScript(() => {
    const log: { names: string[]; durations: number[] }[] = [];
    (window as unknown as { __vt: typeof log }).__vt = log;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
      const transition = start(arg);
      const entry = { names: [] as string[], durations: [] as number[] };
      log.push(entry);
      void transition.ready.then(() => {
        for (const animation of document.getAnimations()) {
          const effect = animation.effect as KeyframeEffect | null;
          if (!effect?.pseudoElement?.startsWith("::view-transition")) continue;
          entry.names.push(effect.pseudoElement);
          entry.durations.push(Number(effect.getComputedTiming().duration));
        }
      });
      return transition;
    }) as typeof document.startViewTransition;
  });
}

async function transitions(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __vt: { names: string[]; durations: number[] }[] }).__vt,
  );
}

test.describe("route transitions prototype", () => {
  test("the shelf lists six fictional stories, each a link named by its title", async ({
    page,
  }) => {
    await page.goto(SHELF);
    await expect(shelfHeading(page)).toBeVisible();
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(6);
    await expect(card(page)).toHaveAttribute("href", `${SHELF}/${STORY.id}`);
    // The golden line describes the card, so it is read after the title.
    await expect(card(page)).toHaveAccessibleDescription(/2 a\.m\./);
  });

  test("a card flies into its page on drift and back on return, and focus comes home", async ({
    page,
  }) => {
    await recordViewTransitions(page);
    await page.goto(SHELF);
    await card(page).click();
    await expect(page).toHaveURL(`${SHELF}/${STORY.id}`);
    await expect(storyHeading(page)).toBeVisible();

    // The plane, title and line exist on both pages under the same names, so they pair up.
    for (const part of ["surface", "title", "line"]) {
      await expect(page.locator(`[data-shared-element="story-${STORY.id}-${part}"]`)).toHaveCount(
        1,
      );
    }
    await expect.poll(async () => (await transitions(page)).length).toBe(1);
    const [opening] = await transitions(page);
    expect(opening?.names).toContain(`::view-transition-group(story-${STORY.id}-title)`);
    // The flight runs on the drift curve (680 ms), far longer than the 120 ms fades around it.
    expect(Math.max(...(opening?.durations ?? [0]))).toBeGreaterThan(400);

    await page.getByRole("link", { name: "All stories" }).click();
    await expect(shelfHeading(page)).toBeVisible();
    await expect.poll(async () => (await transitions(page)).length).toBe(2);
    await expect(card(page)).toBeFocused();
  });

  test("Escape on a story returns to the shelf", async ({ page }) => {
    await page.goto(`${SHELF}/${STORY.id}`);
    await expect(storyHeading(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(SHELF);
    await expect(shelfHeading(page)).toBeVisible();
  });

  test("a flight can be reversed mid-air without waiting for it", async ({ page }) => {
    await page.goto(SHELF);
    await card(page).click();
    // Straight back, while the card is still in flight.
    await page.getByRole("link", { name: "All stories" }).click({ timeout: 2000 });
    await expect(shelfHeading(page)).toBeVisible();
    await expect(page).toHaveURL(SHELF);
    // Nothing is left half-way: the card is in place and takes the next click.
    await card(page).click();
    await expect(storyHeading(page)).toBeVisible();
  });

  test("without the View Transitions API the card still flies, with Motion", async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error: simulating a browser without the API.
      delete Document.prototype.startViewTransition;
    });
    await page.goto(SHELF);
    await card(page).click();
    await expect(storyHeading(page)).toBeVisible();
    const title = page.locator(`[data-shared-element="story-${STORY.id}-title"]`);
    // The fallback flight ends with no transform left behind.
    await expect
      .poll(() => title.evaluate((el) => getComputedStyle(el).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test("an unknown story is not found", async ({ page }) => {
    const response = await page.goto(`${SHELF}/no-such-story`);
    expect(response?.status()).toBe(404);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`both pages have no axe violations with a ${colorScheme} system`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(SHELF);
      await expect(shelfHeading(page)).toBeVisible();
      await expectNoAxeViolations(page);
      await page.goto(`${SHELF}/${STORY.id}`);
      await expect(storyHeading(page)).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
});

test.describe("route transitions prototype, reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the flight becomes a 120 ms fade, and nothing moves", async ({ page }) => {
    await recordViewTransitions(page);
    await page.goto(SHELF);
    await card(page).click();
    await expect(storyHeading(page)).toBeVisible();
    await expect.poll(async () => (await transitions(page)).length).toBe(1);
    const [opening] = await transitions(page);
    // Groups do not animate (no movement); only the old and new snapshots cross-fade. React parks
    // the root group with a zero-length animation of its own, which moves nothing.
    const moving = (opening?.names ?? []).filter(
      (name, i) => name.startsWith("::view-transition-group") && (opening?.durations[i] ?? 0) > 0,
    );
    expect(moving).toEqual([]);
    expect(opening?.names).toContain(`::view-transition-new(story-${STORY.id}-title)`);
    for (const duration of opening?.durations ?? []) expect(duration).toBeLessThanOrEqual(120);

    await page.getByRole("link", { name: "All stories" }).click();
    await expect(shelfHeading(page)).toBeVisible();
    await expect(card(page)).toBeFocused();
  });

  test("has no axe violations", async ({ page }) => {
    await page.goto(SHELF);
    await expectNoAxeViolations(page);
  });
});
