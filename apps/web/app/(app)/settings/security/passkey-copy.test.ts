import { describe, expect, it } from "vitest";
import { PASSKEY_COPY } from "./passkey-copy";

// Spec §6.7: buttons name the exact action; the toast repeats the same verb.
const PAST_TENSE: Record<string, string> = { add: "added", save: "saved", remove: "removed" };

describe("passkey copy", () => {
  for (const [action, copy] of Object.entries(PASSKEY_COPY)) {
    it(`${action}: the toast repeats the verb of "${copy.button}"`, () => {
      const verb = copy.button.split(" ")[0]!.toLowerCase();
      const past = PAST_TENSE[verb];
      expect(past, `past tense of "${verb}"`).toBeDefined();
      expect(copy.toast.toLowerCase().split(" ")).toContain(past);
      // The pending label is the same action in progress.
      expect(copy.pending.toLowerCase()).toMatch(new RegExp(`^${verb.replace(/e$/, "")}ing\\b`));
    });
  }

  it("never uses exclamation marks", () => {
    expect(JSON.stringify(PASSKEY_COPY)).not.toContain("!");
  });
});
