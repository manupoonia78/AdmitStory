// The hero's state machine (direction §4.2), pure. Every animated state can be interrupted:
// Escape or "Try another line" from anywhere returns to idle.
//
//   idle ──sample──▶ sample ──sample_line──▶ placing ──landed──▶ placed
//     │                                         ▲
//     └──write───▶ writing ──submit─────────────┘
//
// The landing page doesn't record: the sample shows the moment a spoken line becomes an essay's
// first line, and "Write your own line" lets the visitor try it with theirs, in the browser only.

import type { FirstLineSource } from "@/lib/marketing/first-line";

export type HeroPhase = "idle" | "writing" | "sample" | "placing" | "placed";

export interface PlacedLine {
  line: string;
  source: FirstLineSource;
  removed: number;
}

export interface HeroState {
  phase: HeroPhase;
  line: PlacedLine | null;
}

export type HeroAction =
  | { type: "write" }
  | { type: "submit"; line: PlacedLine }
  | { type: "sample" }
  | { type: "sample_line"; line: PlacedLine }
  | { type: "landed" }
  | { type: "reset" };

export const INITIAL_HERO_STATE: HeroState = { phase: "idle", line: null };

/** Phases where the visitor is waiting on the page: Escape interrupts them. */
export const INTERRUPTIBLE: ReadonlySet<HeroPhase> = new Set([
  "writing",
  "sample",
  "placing",
  "placed",
]);

export function heroReducer(state: HeroState, action: HeroAction): HeroState {
  switch (action.type) {
    case "write":
      if (state.phase === "placing" || state.phase === "placed") return state;
      return { phase: "writing", line: null };
    case "submit":
      return state.phase === "writing" ? { phase: "placing", line: action.line } : state;
    case "sample":
      if (state.phase !== "idle" && state.phase !== "writing") return state;
      return { phase: "sample", line: null };
    case "sample_line":
      return state.phase === "sample" ? { phase: "placing", line: action.line } : state;
    case "landed":
      return state.phase === "placing" ? { ...state, phase: "placed" } : state;
    case "reset":
      return INITIAL_HERO_STATE;
  }
}
