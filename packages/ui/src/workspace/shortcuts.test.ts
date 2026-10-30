// @vitest-environment jsdom
import "../../test/dom";
import { describe, expect, it } from "vitest";
import { isPlainKey, isTypingTarget } from "./shortcuts";

function element(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as Element;
}

describe("isTypingTarget", () => {
  it("is true for text entry of every kind", () => {
    for (const html of [
      "<input>",
      '<input type="search">',
      '<input type="email">',
      "<textarea></textarea>",
      "<select></select>",
      '<div role="textbox"></div>',
      '<div role="combobox"></div>',
    ]) {
      expect(isTypingTarget(element(html)), html).toBe(true);
    }
  });

  it("is true inside a contenteditable editor", () => {
    const editor = element('<div contenteditable="true"><p>Draft</p></div>') as HTMLElement;
    // jsdom does not compute isContentEditable, so stand in for the browser.
    Object.defineProperty(editor, "isContentEditable", { value: true });
    expect(isTypingTarget(editor)).toBe(true);
  });

  it("is false for buttons, checkboxes, plain elements and nothing", () => {
    for (const html of ["<button></button>", '<input type="checkbox">', "<span></span>"]) {
      expect(isTypingTarget(element(html)), html).toBe(false);
    }
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
  });
});

describe("isPlainKey", () => {
  const press = (init: KeyboardEventInit, target: Element = document.body) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, ...init });
    Object.defineProperty(event, "target", { value: target });
    return event;
  };

  it("matches the bare letter in either case", () => {
    expect(isPlainKey(press({ key: "y" }), "y")).toBe(true);
    expect(isPlainKey(press({ key: "Y", shiftKey: true }), "y")).toBe(true);
    expect(isPlainKey(press({ key: "a" }), "y")).toBe(false);
  });

  it("ignores modifiers, auto-repeat, composition and presses in text fields", () => {
    expect(isPlainKey(press({ key: "y", metaKey: true }), "y")).toBe(false);
    expect(isPlainKey(press({ key: "y", ctrlKey: true }), "y")).toBe(false);
    expect(isPlainKey(press({ key: "y", altKey: true }), "y")).toBe(false);
    expect(isPlainKey(press({ key: "y", repeat: true }), "y")).toBe(false);
    expect(isPlainKey(press({ key: "y", isComposing: true }), "y")).toBe(false);
    expect(isPlainKey(press({ key: "y" }, element("<textarea></textarea>")), "y")).toBe(false);
  });
});
