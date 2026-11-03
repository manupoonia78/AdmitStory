import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.0–2.2 A and AA rules (spec §0, §6.9). */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/**
 * Waits for CSS transitions to finish. A colour transition — the theme cross-fade most of all,
 * which moves every token at once — blends the two colours while it runs, and axe would score
 * the blend rather than the colour anyone actually reads. Only transitions are waited for:
 * ambient CSS animations repeat forever by design, and Motion's own animations are not
 * transitions.
 */
async function settledColours(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (animation) => !(animation instanceof CSSTransition) || animation.playState !== "running",
        ),
    undefined,
    { timeout: 10_000 },
  );
}

/** Runs axe on the settled page and fails with a readable list of violations. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  await settledColours(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes.map((n) => `    ${n.target.join(" ")}\n      ${n.failureSummary ?? ""}`).join("\n"),
  );
  expect(summary, `axe violations on ${page.url()}`).toEqual([]);
}
