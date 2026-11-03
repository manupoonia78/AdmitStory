// The hero's state machine (direction §4.2), pure. Every animated state can be interrupted:
// Escape or "Say it again" from anywhere returns to idle.
//
//   idle ──speak──▶ explaining ──allow──▶ requesting ──listening──▶ listening ──finish──▶ finishing
//     │                 │                                                                 │
//     │                 └──write──▶ writing ──submit──▶ placing ──landed──▶ placed       │
//     ├──sample──▶ sample ──placed──▶ placing                                            │
//     └──write───▶ writing                     transcript (a line) ◀────────────────────┘
//
// Errors are notices on top of a phase: nothing heard (back to idle), microphone blocked and
// Turnstile failed (to writing), and speaking paused (idle, with Speak disabled for the visit).

import type { FirstLineSource } from "@/lib/marketing/first-line";

export type HeroPhase =
  | "idle"
  | "explaining"
  | "requesting"
  | "listening"
  | "finishing"
  | "writing"
  | "sample"
  | "placing"
  | "placed";

export type HeroNotice = "nothing_heard" | "mic_blocked" | "paused" | "turnstile";

export interface PlacedLine {
  line: string;
  source: FirstLineSource;
  removed: number;
}

export interface HeroState {
  phase: HeroPhase;
  notice: HeroNotice | null;
  line: PlacedLine | null;
  /** Speaking is paused for the rest of this visit (busy, rate-limited or switched off). */
  speakPaused: boolean;
}

export type HeroAction =
  | { type: "speak" }
  | { type: "allow" }
  | { type: "listening" }
  | { type: "finish" }
  | { type: "transcript"; line: PlacedLine | null }
  | { type: "write" }
  | { type: "submit"; line: PlacedLine }
  | { type: "sample" }
  | { type: "sample_line"; line: PlacedLine }
  | { type: "landed" }
  | { type: "fail"; notice: HeroNotice }
  | { type: "reset" };

export const INITIAL_HERO_STATE: HeroState = {
  phase: "idle",
  notice: null,
  line: null,
  speakPaused: false,
};

/** Phases where the visitor is waiting on the page: Escape interrupts them. */
export const INTERRUPTIBLE: ReadonlySet<HeroPhase> = new Set([
  "explaining",
  "requesting",
  "listening",
  "finishing",
  "writing",
  "sample",
  "placing",
  "placed",
]);

const RECORDING: ReadonlySet<HeroPhase> = new Set(["requesting", "listening", "finishing"]);

export function heroReducer(state: HeroState, action: HeroAction): HeroState {
  switch (action.type) {
    case "speak":
      if (state.speakPaused || state.phase !== "idle") return state;
      return { ...state, phase: "explaining", notice: null, line: null };
    case "allow":
      return state.phase === "explaining" ? { ...state, phase: "requesting" } : state;
    case "listening":
      return state.phase === "requesting" ? { ...state, phase: "listening" } : state;
    case "finish":
      return state.phase === "listening" || state.phase === "requesting"
        ? { ...state, phase: "finishing" }
        : state;
    case "transcript":
      if (!RECORDING.has(state.phase)) return state;
      return action.line
        ? { ...state, phase: "placing", line: action.line, notice: null }
        : { ...state, phase: "idle", line: null, notice: "nothing_heard" };
    case "write":
      if (state.phase === "placing" || state.phase === "placed") return state;
      return {
        ...state,
        phase: "writing",
        notice: state.notice === "nothing_heard" ? null : state.notice,
        line: null,
      };
    case "submit":
      return state.phase === "writing"
        ? { ...state, phase: "placing", line: action.line, notice: null }
        : state;
    case "sample":
      if (state.phase !== "idle" && state.phase !== "writing" && state.phase !== "placed") {
        return state;
      }
      return { ...state, phase: "sample", line: null, notice: state.speakPaused ? "paused" : null };
    case "sample_line":
      return state.phase === "sample" ? { ...state, phase: "placing", line: action.line } : state;
    case "landed":
      return state.phase === "placing" ? { ...state, phase: "placed" } : state;
    case "fail":
      switch (action.notice) {
        case "nothing_heard":
          return { ...state, phase: "idle", notice: "nothing_heard", line: null };
        case "paused":
          return { ...state, phase: "idle", notice: "paused", line: null, speakPaused: true };
        case "mic_blocked":
        case "turnstile":
          return { ...state, phase: "writing", notice: action.notice, line: null };
      }
      return state;
    case "reset":
      return {
        ...INITIAL_HERO_STATE,
        speakPaused: state.speakPaused,
        notice: state.speakPaused ? "paused" : null,
      };
  }
}

/** The 15-second answer (direction §4.2): the client stops sending at 15 s. */
export const SPEAK_SECONDS = 15;
/** A watchdog disposes everything at 20 s whatever happens (deviation D6). */
export const WATCHDOG_SECONDS = 20;
/** After a sentence end, this much silence ends the answer (the Studio rule). */
export const SILENCE_END_MS = 2500;
