import { describe, expect, it } from "vitest";
import {
  LOW_MINUTES_SECONDS,
  NOTICE_ACTION_LABELS,
  VOICE_COPY,
  heardSoFar,
  lowMinutesCopy,
  recordButtonState,
  refusalCopy,
  studioNotice,
  transcriptSegments,
  type NoticeInput,
} from "./voice-notice";

const READY: NoticeInput = {
  mode: "talk",
  block: null,
  remainingSeconds: 3_600,
  microphone: "idle",
  permission: "granted",
  dictation: "idle",
  connection: "closed",
  longSilence: false,
  nothingHeard: false,
};
const notice = (input: Partial<NoticeInput>) => studioNotice({ ...READY, ...input });

describe("studioNotice", () => {
  it("says nothing when voice is ready", () => {
    expect(notice({})).toBeNull();
  });

  it("explains the microphone before the browser asks, with Allow microphone / Write instead", () => {
    for (const permission of ["prompt", "unknown"] as const) {
      expect(notice({ permission })).toEqual({
        tone: "info",
        message: VOICE_COPY.ask,
        actions: ["allow", "write"],
      });
    }
    expect(NOTICE_ACTION_LABELS.allow).toBe("Allow microphone");
    expect(NOTICE_ACTION_LABELS.write).toBe("Write instead");
    expect(notice({ permission: "prompt", microphone: "live" })).toBeNull();
  });

  it("says why Talk is unavailable in either mode, with no action to retry it", () => {
    const cases = [
      ["email_unverified", VOICE_COPY.unverified],
      ["voice_minutes_used", VOICE_COPY.minutesUsed],
      ["stt_unavailable", VOICE_COPY.sttUnavailable],
      ["denied", VOICE_COPY.denied],
      ["unsupported", VOICE_COPY.unsupported],
    ] as const;
    for (const [block, message] of cases)
      for (const mode of ["talk", "write"] as const)
        expect(notice({ block, mode })).toEqual({ tone: "info", message, actions: [] });
  });

  it("offers a retry and typing when transcription fails, ahead of anything else", () => {
    expect(notice({ dictation: "failed", connection: "offline", microphone: "error" })).toEqual({
      tone: "problem",
      message: VOICE_COPY.sttFailed,
      actions: ["retry-stt", "type"],
    });
  });

  it("tells an applicant who goes offline mid-answer to keep talking", () => {
    expect(notice({ dictation: "listening", connection: "offline" })?.message).toBe(
      VOICE_COPY.offline,
    );
    expect(notice({ dictation: "idle", connection: "offline" })).toBeNull();
  });

  it("offers to try the microphone again when it fails to start", () => {
    expect(notice({ microphone: "error" })).toMatchObject({
      tone: "problem",
      actions: ["retry-mic", "write"],
    });
  });

  it("is gentle about a long silence, only while listening", () => {
    expect(notice({ longSilence: true, dictation: "listening" })?.message).toBe(
      VOICE_COPY.longSilence,
    );
    expect(notice({ longSilence: true, dictation: "done" })).toBeNull();
  });

  it("says when nothing was heard", () => {
    expect(notice({ nothingHeard: true })?.message).toBe(VOICE_COPY.nothingHeard);
  });

  it("warns as the free minutes run low, and not in Write", () => {
    expect(notice({ remainingSeconds: LOW_MINUTES_SECONDS + 1 })).toBeNull();
    expect(notice({ remainingSeconds: 125 })).toEqual({
      tone: "warning",
      message: "About 3 voice minutes left. After that, the Studio carries on in writing.",
      actions: [],
    });
    expect(notice({ remainingSeconds: 125, mode: "write" })).toBeNull();
  });
});

describe("the copy (§6.9)", () => {
  const every = [
    ...Object.values(VOICE_COPY),
    ...Object.values(NOTICE_ACTION_LABELS),
    lowMinutesCopy(30),
    lowMinutesCopy(600),
  ];

  it("never says Oops, Something went wrong, or ends a system message with !", () => {
    for (const line of every) {
      expect(line).not.toMatch(/oops|something went wrong|unleash|supercharge|journey/i);
      expect(line).not.toContain("!");
    }
  });

  it("explains the microphone the way §6.9 does, without promising a recording choice", () => {
    expect(VOICE_COPY.ask).toBe(
      "Admitstory needs your microphone to hear your answers. Audio is turned into text and not kept.",
    );
    expect(VOICE_COPY.denied).toBe(
      "Microphone is blocked in your browser settings. You can keep going by typing.",
    );
  });

  it("names the 120 free minutes and that the Studio carries on in writing (§12.4)", () => {
    expect(VOICE_COPY.minutesUsed).toContain("120 free voice minutes");
    expect(VOICE_COPY.minutesUsed).toContain("carries on in writing");
  });

  it("counts minutes in whole minutes, never zero", () => {
    expect(lowMinutesCopy(10)).toMatch(/^About 1 voice minute left\./);
    expect(lowMinutesCopy(61)).toMatch(/^About 2 voice minutes left\./);
  });

  it("uses the same words for a refusal outside the Studio", () => {
    expect(refusalCopy("email_unverified")).toBe(VOICE_COPY.unverified);
  });
});

describe("recordButtonState", () => {
  it("maps dictation states onto the record button", () => {
    expect(recordButtonState("connecting", false)).toBe("listening");
    expect(recordButtonState("listening", false)).toBe("listening");
    expect(recordButtonState("finishing", false)).toBe("processing");
    expect(recordButtonState("failed", false)).toBe("error");
    expect(recordButtonState("done", true)).toBe("processing");
    expect(recordButtonState("idle", false)).toBe("idle");
  });
});

describe("transcriptSegments", () => {
  it("gives each finished sentence a stable id, the interim words last and dim", () => {
    const first = transcriptSegments({ text: "I grew up in Pune. My", interim: "" }, "a1");
    const later = transcriptSegments(
      { text: "I grew up in Pune. My grandmother ran", interim: "a small shop" },
      "a1",
    );
    expect(first).toEqual([
      { id: "a1-0", text: "I grew up in Pune.", final: true },
      { id: "a1-1", text: "My", final: true },
    ]);
    expect(later).toEqual([
      { id: "a1-0", text: "I grew up in Pune.", final: true },
      { id: "a1-1", text: "My grandmother ran", final: true },
      { id: "a1-interim", text: "a small shop", final: false },
    ]);
  });

  it("splits sentences in other scripts too", () => {
    const segments = transcriptSegments(
      { text: "मैं पुणे में बड़ा हुआ। फिर दिल्ली", interim: "" },
      "b",
    );
    expect(segments.map((segment) => segment.text)).toEqual([
      "मैं पुणे में बड़ा हुआ।",
      "फिर दिल्ली",
    ]);
  });

  it("is empty before anything is heard", () => {
    expect(transcriptSegments({ text: "", interim: " " }, "c")).toEqual([]);
  });
});

describe("heardSoFar", () => {
  it("includes the interim words, so Type instead carries everything heard", () => {
    expect(heardSoFar({ text: "I grew up in Pune.", interim: "My grandmother" })).toBe(
      "I grew up in Pune. My grandmother",
    );
    expect(heardSoFar({ text: "", interim: "" })).toBe("");
  });
});
