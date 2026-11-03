import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./support/axe";

// The Voiceprint review lab (spec §6.2, §6.11, §16 Phase 0.5). The microphone is replaced in the
// page: one variant refuses permission, the other hands back a synthetic tone from an
// oscillator, so no real device or audio is involved.

const PATH = "/prototype/voiceprint";

const heroVoiceprint = (page: Page) => page.getByRole("img", { name: "Your Voiceprint" });

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

async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const context = new AudioContext();
          const tone = context.createOscillator();
          tone.frequency.value = 160;
          const output = context.createMediaStreamDestination();
          tone.connect(output);
          tone.start();
          return output.stream;
        },
      },
    });
  });
}

test.describe("Voiceprint lab", () => {
  test("shows the live form, the microphone request and all twelve hues", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole("heading", { level: 1, name: "Your Voiceprint" })).toBeVisible();
    const voiceprint = heroVoiceprint(page);
    await expect(voiceprint).toBeVisible();
    const box = await voiceprint.boundingBox();
    expect(box?.width).toBeGreaterThan(200);
    expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThan(1);

    await expect(
      page.getByText("AdmitStory needs your microphone to hear your answers."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Allow microphone" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Write instead" })).toBeVisible();

    const hues = page.getByRole("region", { name: "Twelve hues" }).getByRole("button");
    await expect(hues).toHaveCount(12);
  });

  test("never moves the layout while the renderer loads", async ({ page }) => {
    await page.goto(PATH);
    const before = await heroVoiceprint(page).boundingBox();
    await page.waitForTimeout(1500);
    const after = await heroVoiceprint(page).boundingBox();
    expect(after).toEqual(before);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no axe violations with a ${colorScheme} system`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(PATH);
      await expect(heroVoiceprint(page)).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }

  test("is the still form, without a pulse, under reduced motion, whatever tier is forced", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH);
    await expect(
      page.getByText("Reduced motion is on, so the Voiceprint stays still"),
    ).toBeVisible();

    await page.getByText("3 full", { exact: true }).click();
    const voiceprint = heroVoiceprint(page);
    await expect(voiceprint).toHaveAttribute("data-renderer", "still");
    await expect(voiceprint).toHaveAttribute("data-tier", "1");
    await expect(voiceprint.locator("canvas")).toHaveCount(0);
    await expect(voiceprint.locator("svg")).toHaveCount(1);
    const animations = await voiceprint.evaluate(
      (element) => element.getAnimations({ subtree: true }).length,
    );
    expect(animations).toBe(0);
    await expectNoAxeViolations(page);
  });

  test("forcing tier 1 shows the still with its slow pulse", async ({ page }) => {
    await page.goto(PATH);
    await page.getByText("1 still", { exact: true }).click();
    const voiceprint = heroVoiceprint(page);
    await expect(voiceprint).toHaveAttribute("data-tier", "1");
    await expect(voiceprint).toHaveAttribute("data-renderer", "still");
    await expect(voiceprint.locator("canvas")).toHaveCount(0);
    await expect(voiceprint.locator(".admitstory-voiceprint-pulse")).toHaveCount(1);
  });

  test("says when the microphone is blocked and offers typing", async ({ page }) => {
    await refuseMicrophone(page);
    await page.goto(PATH);
    await page.getByRole("button", { name: "Allow microphone" }).click();
    await expect(
      page.getByText(
        "Microphone is blocked in your browser settings. You can keep going by typing.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Write instead" }).click();
    await expect(page.getByRole("textbox", { name: "Your written answers" })).toBeFocused();
  });

  test("listens to a microphone, samples speech, and stops cleanly", async ({ page }) => {
    await fakeMicrophone(page);
    await page.goto(PATH);
    await page.getByRole("button", { name: "Allow microphone" }).click();
    await expect(page.getByText("Your Voiceprint is listening.")).toBeVisible();

    await page.getByRole("button", { name: "Record a 3-minute sample" }).click();
    await expect(page.getByRole("progressbar", { name: "Speech sampled" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use what I have" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel sample" }).click();
    await expect(page.getByText("Sample cancelled. Your Voiceprint hasn't changed.")).toBeVisible();

    await page.getByRole("button", { name: "Turn off microphone" }).click();
    await expect(page.getByRole("button", { name: "Allow microphone" })).toBeVisible();
  });

  test("seeds the Voiceprint from writing and keeps it for the other prototypes", async ({
    page,
  }) => {
    await page.goto(PATH);
    const readout = page.getByRole("region", { name: "What it heard" });
    await expect(readout).toContainText("Default, until you speak or write");

    await page.getByRole("button", { name: "Seed my Voiceprint from writing" }).click();
    await expect(page.getByText("Write or paste at least one sentence first.")).toBeVisible();

    await page.getByRole("button", { name: "Fill in sample answers" }).click();
    await page.getByRole("button", { name: "Seed my Voiceprint from writing" }).click();
    await expect(page.getByText("Voiceprint seeded from your writing.")).toBeVisible();
    await expect(readout).toContainText("Your writing");

    await page.reload();
    await expect(page.getByRole("region", { name: "What it heard" })).toContainText("Your writing");
  });

  test("lets the reviewer pick a hue from the gallery", async ({ page }) => {
    await page.goto(PATH);
    const gallery = page.getByRole("region", { name: "Twelve hues" });
    const own = gallery.getByRole("button", { pressed: true });
    await expect(own).toHaveCount(1);
    const unpressed = gallery.getByRole("button", { pressed: false }).first();
    const name = (await unpressed.locator("span.font-medium").textContent()) ?? "";
    // Pinned by name: once clicked, "the first unpressed hue" is a different button.
    const other = gallery.getByRole("button", { name: new RegExp(`^${name}\\b`) });
    await other.click();
    await expect(other).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "What it heard" })).toContainText(
      `${name}, chosen by hand`,
    );
  });
});
