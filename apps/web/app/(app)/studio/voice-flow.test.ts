import { describe, expect, it } from "vitest";
import {
  appendAnswer,
  composedTurn,
  initialVoiceFlow,
  spokenTurn,
  talkAvailable,
  voiceFlowReducer,
  type SpokenAnswer,
  type VoiceFlowEvent,
  type VoiceFlowState,
} from "./voice-flow";

const talking = initialVoiceFlow({ emailVerified: true, remainingSeconds: 3_600 });
const run = (state: VoiceFlowState, ...events: VoiceFlowEvent[]) =>
  events.reduce(voiceFlowReducer, state);

const SAID: SpokenAnswer = { text: "I grew up in Pune.", seconds: 4.237, language: null };

describe("initialVoiceFlow", () => {
  it("starts in Talk for a verified applicant with minutes left", () => {
    expect(talking).toMatchObject({ mode: "talk", block: null, remainingSeconds: 3_600 });
  });

  it("starts in Write, saying why, without a verified email (§12.4)", () => {
    const state = initialVoiceFlow({ emailVerified: false, remainingSeconds: 3_600 });
    expect(state).toMatchObject({ mode: "write", block: "email_unverified" });
    expect(talkAvailable(state)).toBe(false);
  });

  it("starts in Write once the free voice minutes are used (§12.4)", () => {
    const state = initialVoiceFlow({ emailVerified: true, remainingSeconds: -5 });
    expect(state).toMatchObject({
      mode: "write",
      block: "voice_minutes_used",
      remainingSeconds: 0,
    });
  });
});

describe("switching input mode per answer", () => {
  it("moves between Talk and Write", () => {
    const written = run(talking, { type: "mode", mode: "write" });
    expect(written.mode).toBe("write");
    expect(run(written, { type: "mode", mode: "talk" }).mode).toBe("talk");
  });

  it("does not offer Talk while a hard block stands", () => {
    for (const block of ["email_unverified", "voice_minutes_used", "unsupported"] as const) {
      const state = { ...talking, mode: "write" as const, block };
      expect(run(state, { type: "mode", mode: "talk" })).toBe(state);
    }
  });

  it("lets the applicant ask again for a blocked microphone or a failed STT", () => {
    for (const block of ["denied", "stt_unavailable"] as const) {
      const state = { ...talking, mode: "write" as const, block };
      expect(run(state, { type: "mode", mode: "talk" })).toMatchObject({
        mode: "talk",
        block: null,
      });
    }
  });

  it("keeps what is in the composer across a switch", () => {
    const state = run(
      talking,
      { type: "mode", mode: "write" },
      { type: "draft", text: "Half typed" },
      { type: "mode", mode: "talk" },
    );
    expect(state.draft).toBe("Half typed");
  });
});

describe("the microphone", () => {
  it("moves to Write when it is denied or missing, and clears a denial once live", () => {
    const denied = run(talking, { type: "microphone", status: "denied" });
    expect(denied).toMatchObject({ mode: "write", block: "denied" });
    expect(run(denied, { type: "microphone", status: "live" }).block).toBeNull();
    expect(run(talking, { type: "microphone", status: "unsupported" })).toMatchObject({
      mode: "write",
      block: "unsupported",
    });
  });

  it("does not clear another block when the microphone comes up", () => {
    const state = { ...talking, block: "stt_unavailable" as const };
    expect(run(state, { type: "microphone", status: "live" })).toBe(state);
  });
});

describe("a dictated answer", () => {
  it("is sent with its seconds (rounded to 0.01) and no language when Deepgram gave none", () => {
    expect(spokenTurn(SAID)).toEqual({
      text: "I grew up in Pune.",
      fields: { inputMode: "voice", voiceSeconds: 4.24 },
    });
    expect(spokenTurn({ ...SAID, language: "hi" })?.fields.language).toBe("hi");
  });

  it("sends nothing when nothing was heard, and says so", () => {
    const empty = { ...SAID, text: "  " };
    expect(spokenTurn(empty)).toBeNull();
    const state = run(talking, { type: "answer", answer: empty });
    expect(state.nothingHeard).toBe(true);
    expect(run(state, { type: "dictation-start" }).nothingHeard).toBe(false);
  });

  it("counts its seconds down from the free minutes once sent", () => {
    const state = run(talking, { type: "sent", voiceSeconds: 600 });
    expect(state.remainingSeconds).toBe(3_000);
    expect(state.mode).toBe("talk");
  });

  it("continues in Write once the minutes run out on an answer (§12.4)", () => {
    const state = run({ ...talking, remainingSeconds: 30 }, { type: "sent", voiceSeconds: 31 });
    expect(state).toMatchObject({
      mode: "write",
      block: "voice_minutes_used",
      remainingSeconds: 0,
    });
  });

  it("takes the free seconds left from each STT token", () => {
    expect(run(talking, { type: "remaining", seconds: 42 }).remainingSeconds).toBe(42);
  });
});

describe("nothing said is lost", () => {
  it("moves the words heard so far into the composer on a refusal, still as a voice answer", () => {
    const state = run(
      { ...talking, remainingSeconds: 5 },
      { type: "refused", reason: "voice_minutes_used", partial: SAID },
    );
    expect(state).toMatchObject({
      mode: "write",
      block: "voice_minutes_used",
      remainingSeconds: 0,
      draft: "I grew up in Pune.",
    });
    expect(composedTurn(state)).toEqual({
      text: "I grew up in Pune.",
      fields: { inputMode: "voice", voiceSeconds: 4.24 },
    });
  });

  it("keeps the minutes on an email or STT refusal", () => {
    const state = run(talking, { type: "refused", reason: "stt_unavailable", partial: SAID });
    expect(state).toMatchObject({ block: "stt_unavailable", remainingSeconds: 3_600 });
    expect(talkAvailable(state)).toBe(true);
  });

  it("carries a partial answer into the composer on Type instead", () => {
    const state = run(
      talking,
      { type: "type-instead", partial: SAID },
      { type: "draft", text: "I grew up in Pune. Mostly with my grandmother." },
    );
    expect(state.mode).toBe("write");
    expect(composedTurn(state)).toEqual({
      text: "I grew up in Pune. Mostly with my grandmother.",
      fields: { inputMode: "voice", voiceSeconds: 4.24 },
    });
  });

  it("adds a second dictation's seconds to the first", () => {
    const state = run(
      talking,
      { type: "type-instead", partial: SAID },
      { type: "mode", mode: "talk" },
      { type: "type-instead", partial: { text: "And then Delhi.", seconds: 2, language: "en" } },
    );
    expect(state.draft).toBe("I grew up in Pune.\n\nAnd then Delhi.");
    expect(state.carried).toEqual({ seconds: 6.237, language: "en" });
  });

  it("treats an emptied composer as typed", () => {
    const state = run(
      talking,
      { type: "type-instead", partial: SAID },
      { type: "draft", text: "" },
      { type: "draft", text: "Typed from scratch" },
    );
    expect(composedTurn(state).fields).toEqual({ inputMode: "text" });
  });

  it("puts a spoken answer that could not be sent into the composer, then returns to Talk", () => {
    const turn = spokenTurn(SAID)!;
    const failed = run(talking, { type: "send-failed", ...turn });
    expect(failed).toMatchObject({ mode: "write", draft: "I grew up in Pune.", resumeTalk: true });
    expect(composedTurn(failed)).toEqual(turn);

    const sent = run(failed, { type: "sent", voiceSeconds: 4.24 });
    expect(sent).toMatchObject({ mode: "talk", draft: "", carried: null, resumeTalk: false });
  });

  it("leaves a typed answer that could not be sent where it is", () => {
    const writing = run(talking, { type: "mode", mode: "write" }, { type: "draft", text: "Typed" });
    const failed = run(writing, {
      type: "send-failed",
      text: "Typed",
      fields: { inputMode: "text" },
    });
    expect(failed).toMatchObject({ mode: "write", draft: "Typed", resumeTalk: false });
    expect(run(failed, { type: "sent", voiceSeconds: 0 }).mode).toBe("write");
  });
});

describe("appendAnswer", () => {
  it("joins dictation onto a draft a paragraph apart, and ignores empty words", () => {
    expect(appendAnswer("", " First. ")).toBe("First.");
    expect(appendAnswer("First.  ", "Second.")).toBe("First.\n\nSecond.");
    expect(appendAnswer("First.", "   ")).toBe("First.");
  });
});
