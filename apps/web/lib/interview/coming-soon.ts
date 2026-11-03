// Interview Studio (spec §5.12) is deferred past launch (docs/phase-7-interview-studio.md).
// Everything that mentions it uses these words, so they stay honest (§14.5) and are easy to find
// and remove when Phase 7 ships: grep for COMING_SOON.
//
// Unlike the Phase 8 areas in lib/deferred/coming-soon.ts, this one carries a promise: it is named
// on the marketing site as free for kit owners when it opens, so `promise` must stay in the copy.

import { COMING_SOON } from "@/lib/deferred/coming-soon";

export { COMING_SOON };

export const INTERVIEW_COMING_SOON = {
  title: "Interview",
  headline: "Practise the interview with the stories you already told.",
  status: COMING_SOON,
  promise: "Interview practice is coming soon. Kit owners get it at no extra cost when it opens.",
  parts: [
    {
      name: "Your interview plan",
      line: "Each school's format, likely questions, and one of your stories for each.",
    },
    {
      name: "Drills",
      line: "Answer one question out loud and hear what to fix, in a few seconds.",
    },
    {
      name: "Mock interviews",
      line: "A full voice interview that follows up on what you actually said.",
    },
    {
      name: "Timed video practice",
      line: "Think time and an answer window that match the school's format.",
    },
  ],
} as const;
