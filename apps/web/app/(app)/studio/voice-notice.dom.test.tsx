// @vitest-environment jsdom
import { LiveTranscript, VoiceNotice } from "@admitstory/ui";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTICE_ACTION_LABELS,
  studioNotice,
  transcriptSegments,
  type NoticeInput,
} from "./voice-notice";

// The Studio's voice states as the applicant meets them: the notice the stage renders for each
// state, and the live transcript fed from a dictation snapshot. apps/web has no Testing Library,
// so these render with react-dom directly.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const READY: NoticeInput = {
  mode: "talk",
  block: null,
  remainingSeconds: 3_600,
  microphone: "idle",
  permission: "prompt",
  dictation: "idle",
  connection: "closed",
  longSilence: false,
  nothingHeard: false,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderNotice(input: Partial<NoticeInput>, handlers: Record<string, () => void> = {}) {
  const notice = studioNotice({ ...READY, ...input });
  const actions = (notice?.actions ?? []).map((action, index) => ({
    label: NOTICE_ACTION_LABELS[action],
    onClick: handlers[action] ?? (() => {}),
    primary: index === 0,
  }));
  act(() => root.render(<VoiceNotice notice={notice} actions={actions} />));
}

const buttons = () => [...container.querySelectorAll("button")].map((button) => button.textContent);

describe("the Studio's microphone notices", () => {
  it("asks for the microphone with a plain explanation and a way to write instead", () => {
    const write = vi.fn();
    renderNotice({}, { write });
    expect(container.querySelector("[role=status]")?.textContent).toBe(
      "Admitstory needs your microphone to hear your answers. Audio is turned into text and not kept.",
    );
    expect(buttons()).toEqual(["Allow microphone", "Write instead"]);
    act(() => container.querySelectorAll("button")[1]!.click());
    expect(write).toHaveBeenCalledOnce();
  });

  it("says a blocked microphone plainly, with nothing to press", () => {
    renderNotice({ block: "denied", mode: "write" });
    expect(container.textContent).toBe(
      "Microphone is blocked in your browser settings. You can keep going by typing.",
    );
    expect(buttons()).toEqual([]);
  });

  it("offers Try again and Type instead when transcription fails", () => {
    const retry = vi.fn();
    renderNotice({ microphone: "live", dictation: "failed" }, { "retry-stt": retry });
    expect(buttons()).toEqual(["Try again", "Type instead"]);
    act(() => container.querySelector("button")!.click());
    expect(retry).toHaveBeenCalledOnce();
  });

  it("tells an unverified applicant why talking is off", () => {
    renderNotice({ block: "email_unverified" });
    expect(container.textContent).toContain("Talking needs a verified email.");
  });

  it("says the free minutes are used and the Studio carries on in writing", () => {
    renderNotice({ block: "voice_minutes_used", mode: "write" });
    expect(container.textContent).toContain("120 free voice minutes");
  });

  it("warns when the minutes are running low", () => {
    renderNotice({ microphone: "live", remainingSeconds: 240 });
    expect(container.textContent).toBe(
      "About 4 voice minutes left. After that, the Studio carries on in writing.",
    );
  });
});

describe("the live transcript of a dictation", () => {
  it("shows interim words dim and announces only finished sentences", () => {
    act(() =>
      root.render(
        <LiveTranscript
          segments={transcriptSegments(
            { text: "I grew up in Pune. My grandmother", interim: "ran a shop" },
            "a1",
          )}
          label="Your answer"
        />,
      ),
    );
    const log = container.querySelector("[role=log]")!;
    expect(log.getAttribute("aria-live")).toBe("polite");
    expect([...log.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "I grew up in Pune.",
      "My grandmother",
    ]);
    const interim = container.querySelectorAll("[data-interim]");
    expect([...interim].map((word) => word.textContent)).toEqual(["ran", "a", "shop"]);
    expect(interim[0]!.className).toContain("opacity-40");
  });
});
