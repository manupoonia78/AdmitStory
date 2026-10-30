// Fake data and the scripted timeline for the live mock prototype (spec §6.7 "Live mock",
// §6.10 J, §16 Phase 0.5). The school is fictional and so is the applicant: the same backend
// engineer as the Studio prototype. No real school's questions are used.
//
// Both sides speak from word timings: the interviewer's voice and the sample answers become
// synthetic voice signals, and captions follow the same timings. Pure, so the timeline is tested.

import {
  estimateWordTimings,
  spansFromTimings,
  type DuetSpeaker,
  type VoicedSpan,
  type VoiceprintIdentity,
  type WordTiming,
} from "@admitstory/ui";

export const MOCK = {
  title: "Northfield mock",
  /** Each its own item on screen: no joined meta strings (spec §6.1). */
  details: ["Admissions officer", "File-read", "30 min"],
} as const;

/** The interviewer's form: a calm, even speaker. Rendered in silver, so only its shape matters. */
export const INTERVIEWER_IDENTITY: VoiceprintIdentity = {
  version: 1,
  avgPitchHz: 128,
  paceWpm: 150,
  pitchRangeSemitones: 5,
  pauseRhythm: 0.25,
  source: "default",
};

export interface DuetTurn {
  speaker: Exclude<DuetSpeaker, null>;
  text: string;
}

export const TURNS: readonly DuetTurn[] = [
  {
    speaker: "interviewer",
    text: "Thanks for making the time. Walk me through how you got from engineering to an MBA.",
  },
  {
    speaker: "you",
    text: "I spent six years building hospital software, and the hardest problems were never the code. They were getting three departments to agree on one plan.",
  },
  {
    speaker: "interviewer",
    text: "You mentioned the go-live. What would you do differently now?",
  },
  {
    speaker: "you",
    text: "Honestly, I'd have asked for help earlier, because I treated the night shift as mine to fix alone. Next time I'd bring the lab team in before the first failure.",
  },
  {
    speaker: "interviewer",
    text: "Why Northfield, and why now?",
  },
  {
    speaker: "you",
    text: "The operations lab works with real hospital networks, and I want to lead that kind of change, not only build the tools for it.",
  },
  {
    speaker: "interviewer",
    text: "That's all my questions. Thank you for a thoughtful conversation.",
  },
];

export interface PlannedTurn extends DuetTurn {
  /** When the first word starts, on the script clock. */
  startMs: number;
  endMs: number;
  /** Word timings from the start of the turn, for captions. */
  words: WordTiming[];
}

export interface DuetPlan {
  turns: PlannedTurn[];
  /** Voiced spans on the script clock, per speaker, for the synthetic voices. */
  spans: Record<Exclude<DuetSpeaker, null>, VoicedSpan[]>;
  endMs: number;
}

export interface DuetPlanOptions {
  leadInMs?: number;
  /** Silence between turns: the listener taking a breath before answering. */
  gapMs?: number;
  interviewerWpm?: number;
  yourWpm?: number;
}

export function planDuet(
  turns: readonly DuetTurn[],
  { leadInMs = 900, gapMs = 1100, interviewerWpm = 150, yourWpm = 165 }: DuetPlanOptions = {},
): DuetPlan {
  const planned: PlannedTurn[] = [];
  const spans: DuetPlan["spans"] = { interviewer: [], you: [] };
  let cursor = leadInMs;
  for (const turn of turns) {
    const wpm = turn.speaker === "interviewer" ? interviewerWpm : yourWpm;
    const words = estimateWordTimings(turn.text, { wpm });
    const length = words.at(-1)?.endMs ?? 0;
    planned.push({ ...turn, startMs: cursor, endMs: cursor + length, words });
    for (const span of spansFromTimings(words)) {
      spans[turn.speaker].push({ startMs: span.startMs + cursor, endMs: span.endMs + cursor });
    }
    cursor += length + gapMs;
  }
  return { turns: planned, spans, endMs: planned.at(-1)?.endMs ?? 0 };
}

/** Who is speaking at `ms`: null before the first turn, between turns and after the last. */
export function speakerAt(plan: DuetPlan, ms: number): DuetSpeaker {
  const turn = plan.turns.find((t) => ms >= t.startMs && ms < t.endMs);
  return turn?.speaker ?? null;
}

/**
 * Which turn each caption line shows at `ms`: the interviewer's latest question stays up until
 * the next one; your latest answer shows only if it came after that question.
 */
export function captionsAt(
  plan: DuetPlan,
  ms: number,
): { interviewer: number | null; you: number | null } {
  let interviewer: number | null = null;
  let you: number | null = null;
  plan.turns.forEach((turn, index) => {
    if (turn.startMs > ms) return;
    if (turn.speaker === "interviewer") {
      interviewer = index;
      you = null;
    } else {
      you = index;
    }
  });
  return { interviewer, you };
}

/**
 * Advances the script clock by `dtMs`. With "Need a moment" on, the interviewer waits: the clock
 * stops just before their next turn starts, but never cuts off a turn already under way.
 */
export function advanceScript(plan: DuetPlan, ms: number, dtMs: number, waiting: boolean): number {
  const next = ms + Math.max(0, dtMs);
  if (!waiting) return next;
  const upcoming = plan.turns.find((t) => t.speaker === "interviewer" && t.startMs > ms);
  return upcoming ? Math.min(next, upcoming.startMs - 1) : next;
}
