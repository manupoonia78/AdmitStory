import { describe, expect, it } from "vitest";
import { isCommandK } from "./keyboard-shortcut";

type Keys = Partial<Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">>;

function keydown(keys: Keys): KeyboardEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...keys,
  } as KeyboardEvent;
}

describe("isCommandK", () => {
  it("matches ⌘K and Ctrl K, either case", () => {
    expect(isCommandK(keydown({ key: "k", metaKey: true }))).toBe(true);
    expect(isCommandK(keydown({ key: "K", ctrlKey: true }))).toBe(true);
  });

  it("ignores K without a modifier, or with Alt or Shift", () => {
    expect(isCommandK(keydown({ key: "k" }))).toBe(false);
    expect(isCommandK(keydown({ key: "k", ctrlKey: true, altKey: true }))).toBe(false);
    expect(isCommandK(keydown({ key: "k", metaKey: true, shiftKey: true }))).toBe(false);
  });

  it("does not throw on a keydown with no key (Chrome autofill)", () => {
    expect(isCommandK(keydown({ ctrlKey: true }))).toBe(false);
    expect(isCommandK(keydown({ key: undefined as unknown as string, metaKey: true }))).toBe(false);
  });
});
