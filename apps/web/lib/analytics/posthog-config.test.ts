import { describe, expect, it } from "vitest";
import { posthogConfig } from "./posthog-client";

describe("posthogConfig (spec §14.4: no essay or transcript content in analytics)", () => {
  const config = posthogConfig(undefined);

  it("creates person profiles for identified users only", () => {
    expect(config.person_profiles).toBe("identified_only");
  });

  it("masks every input and every text node in replays", () => {
    expect(config.session_recording).toEqual({ maskAllInputs: true, maskTextSelector: "*" });
  });

  it("captures clicks without element text or attributes", () => {
    expect(config.mask_all_text).toBe(true);
    expect(config.mask_all_element_attributes).toBe(true);
    expect(config.autocapture).toEqual({ capture_copied_text: false });
  });

  it("uses POSTHOG_HOST when given", () => {
    expect(posthogConfig("https://eu.i.posthog.com").api_host).toBe("https://eu.i.posthog.com");
  });
});
