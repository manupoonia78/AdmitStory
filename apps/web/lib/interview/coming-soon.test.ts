import { describe, expect, it } from "vitest";
import { COMING_SOON, INTERVIEW_COMING_SOON } from "./coming-soon";

// Spec §14.5 (honest claims) and §6.9 (voice): the deferred Interview Studio is described as
// coming, never as something that works today.
describe("Interview Studio coming-soon copy", () => {
  const all = [
    INTERVIEW_COMING_SOON.headline,
    INTERVIEW_COMING_SOON.promise,
    ...INTERVIEW_COMING_SOON.parts.flatMap((p) => [p.name, p.line]),
  ].join(" ");

  it("says it is coming soon", () => {
    expect(INTERVIEW_COMING_SOON.status).toBe(COMING_SOON);
    expect(INTERVIEW_COMING_SOON.promise).toMatch(/coming soon/i);
  });

  it("follows the voice rules", () => {
    expect(all).not.toMatch(/!|unleash|supercharge|journey|guarantee/i);
  });
});
