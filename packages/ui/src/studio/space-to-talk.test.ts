// @vitest-environment jsdom
import "../../test/dom";
import { describe, expect, it } from "vitest";
import {
  HOLD_TO_TALK_MS,
  canTalkFrom,
  isSpaceKey,
  isTextEntry,
  releaseAction,
} from "./space-to-talk";

function element(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host.firstElementChild as HTMLElement;
}

describe("isSpaceKey", () => {
  it("recognises Space by code or key", () => {
    expect(isSpaceKey({ code: "Space", key: " " })).toBe(true);
    expect(isSpaceKey({ code: "", key: " " })).toBe(true);
    expect(isSpaceKey({ code: "KeyS", key: "s" })).toBe(false);
  });
});

describe("isTextEntry", () => {
  it("is true for fields that take typing", () => {
    expect(isTextEntry(element("<input>"))).toBe(true);
    expect(isTextEntry(element("<input type='email'>"))).toBe(true);
    expect(isTextEntry(element("<textarea></textarea>"))).toBe(true);
    expect(isTextEntry(element("<select></select>"))).toBe(true);
    expect(isTextEntry(element("<div role='textbox'></div>"))).toBe(true);
  });

  it("is false for checkboxes, buttons and plain elements", () => {
    expect(isTextEntry(element("<input type='checkbox'>"))).toBe(false);
    expect(isTextEntry(element("<button>Done</button>"))).toBe(false);
    expect(isTextEntry(element("<p>Hello</p>"))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

describe("canTalkFrom", () => {
  const record = element("<button>Record</button>");

  it("lets Space drive recording from the page and from the record button", () => {
    expect(canTalkFrom(document.body, record)).toBe(true);
    expect(canTalkFrom(element("<p>Question</p>"), record)).toBe(true);
    expect(canTalkFrom(record, record)).toBe(true);
    expect(canTalkFrom(null, record)).toBe(true);
  });

  it("leaves Space to fields and other controls", () => {
    expect(canTalkFrom(element("<textarea></textarea>"), record)).toBe(false);
    expect(canTalkFrom(element("<button>Done</button>"), record)).toBe(false);
    expect(canTalkFrom(element("<a href='/'>Home</a>"), record)).toBe(false);
    expect(canTalkFrom(element("<div role='tab'>Work</div>"), record)).toBe(false);
    expect(canTalkFrom(element("<input type='checkbox'>"), record)).toBe(false);
    const inner = element("<button><span>Skip for now</span></button>").firstElementChild;
    expect(canTalkFrom(inner, record)).toBe(false);
  });
});

describe("releaseAction", () => {
  it("stops after a hold and keeps recording after a tap", () => {
    expect(releaseAction(HOLD_TO_TALK_MS - 1)).toBe("keep");
    expect(releaseAction(HOLD_TO_TALK_MS)).toBe("stop");
    expect(releaseAction(4000)).toBe("stop");
  });
});
