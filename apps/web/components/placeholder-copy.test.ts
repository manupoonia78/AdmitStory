import { describe, expect, it } from "vitest";
import { PLACEHOLDERS } from "./placeholder-copy";

// Spec §6.5: an empty state is a headline, one line and (later) one action. §6.7: no "Oops",
// no exclamation marks, sentence case.
const MAX_DESCRIPTION = 64;

describe("placeholder empty states", () => {
  for (const [key, copy] of Object.entries(PLACEHOLDERS)) {
    it(`${key}: the description is one short line`, () => {
      expect(copy.emptyDescription.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
      expect(copy.emptyDescription).not.toMatch(/\n/);
      expect(copy.emptyDescription).toMatch(/\.$/);
    });

    it(`${key}: follows the voice rules`, () => {
      const all = `${copy.title} ${copy.emptyTitle} ${copy.emptyDescription}`;
      expect(all).not.toMatch(/!|oops|something went wrong|unleash|supercharge|journey/i);
      expect(copy.emptyTitle).toMatch(/^[A-Z][^A-Z]*$/);
    });
  }
});
