// @vitest-environment jsdom
import "../../test/dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VoiceSignalRef } from "../voiceprint/types";
import { RecordButton, type RecordButtonState } from "./record-button";
import { HOLD_TO_TALK_MS } from "./space-to-talk";

/** A Space key event at a chosen time, so holds and taps can be told apart. */
function space(type: "keydown" | "keyup", target: EventTarget, timeStamp: number) {
  const event = new KeyboardEvent(type, {
    key: " ",
    code: "Space",
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function setup(state: RecordButtonState = "idle", extra: { signal?: VoiceSignalRef } = {}) {
  const onStart = vi.fn();
  const onStop = vi.fn();
  const utils = render(
    <>
      <input aria-label="Your answer" />
      <button type="button">Done</button>
      <RecordButton state={state} onStart={onStart} onStop={onStop} {...extra} />
    </>,
  );
  const button = screen.getByRole("button", { name: "Record your answer" });
  return { ...utils, onStart, onStop, button };
}

describe("RecordButton", () => {
  it("is a toggle with a stable name, a shortcut and a status line", () => {
    const { button } = setup();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Space");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Tap to talk, or hold Space");
    expect(button.getAttribute("aria-describedby")).toBe(status.id);
  });

  it("starts on click when idle and stops on click when listening", () => {
    const idle = setup("idle");
    fireEvent.click(idle.button);
    expect(idle.onStart).toHaveBeenCalledTimes(1);
    idle.unmount();

    const listening = setup("listening");
    expect(listening.button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Listening");
    fireEvent.click(listening.button);
    expect(listening.onStop).toHaveBeenCalledTimes(1);
  });

  it("ignores presses while processing, and says what is happening", () => {
    const { button, onStart, onStop } = setup("processing");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    space("keydown", document.body, 0);
    expect(onStart).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Writing down your answer");
  });

  it("offers a retry in the error state", () => {
    const { button, onStart } = setup("error");
    expect(screen.getByRole("status").textContent).toBe("We couldn't hear that. Tap to try again.");
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("records while Space is held and stops on release", () => {
    const { onStart, onStop } = setup();
    space("keydown", document.body, 1000);
    expect(onStart).toHaveBeenCalledTimes(1);
    space("keyup", document.body, 1000 + HOLD_TO_TALK_MS + 50);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("treats a quick tap of Space as a toggle and keeps recording", () => {
    const { onStart, onStop } = setup();
    const down = space("keydown", document.body, 1000);
    expect(down.defaultPrevented).toBe(true);
    space("keyup", document.body, 1100);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("stops with Space when already listening", () => {
    const { onStop, onStart } = setup("listening");
    space("keydown", document.body, 0);
    space("keyup", document.body, 2000);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("leaves Space alone in a text field and on other buttons", () => {
    const { onStart } = setup();
    const field = screen.getByRole("textbox", { name: "Your answer" });
    const typed = space("keydown", field, 0);
    expect(typed.defaultPrevented).toBe(false);
    space("keyup", field, 10);
    space("keydown", screen.getByRole("button", { name: "Done" }), 20);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("handles Space on the record button once, swallowing the click that follows", () => {
    const { button, onStart } = setup();
    button.focus();
    space("keydown", button, 0);
    space("keyup", button, 50);
    // The browser's keyboard click after the key-up (detail 0).
    fireEvent.click(button, { detail: 0 });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("stops a held recording when the window loses focus mid-hold", () => {
    const { onStop } = setup();
    space("keydown", document.body, 0);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("does not listen for Space when spaceToTalk is off", () => {
    const onStart = vi.fn();
    render(<RecordButton state="idle" onStart={onStart} onStop={() => {}} spaceToTalk={false} />);
    space("keydown", document.body, 0);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("moves its ring with the live amplitude while listening, without re-rendering", async () => {
    const signal: VoiceSignalRef = { current: { amplitude: 1, centroid: 0, pitchDelta: 0 } };
    const { button } = setup("listening", { signal });
    const ring = button.querySelector<HTMLElement>("span[aria-hidden='true']")!;
    await waitFor(() => expect(ring.style.transform).toMatch(/scale\(1\.[1-4]/));
    expect(Number(ring.style.opacity)).toBeGreaterThan(0.5);
  });
});
