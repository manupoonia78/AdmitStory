// Areas the launch build does not open yet. Everything that mentions one uses these words, so the
// claims stay honest (spec §14.5) and are easy to find and remove when the phase ships: grep for
// COMING_SOON.
//
// Phase 7 (Interview Studio) is deferred with a promise attached — kit owners get it at no extra
// cost when it opens — and keeps its own copy in lib/interview/coming-soon.ts.
// Phase 8 (Experts, Connect, Tracker, Notifications, After decisions) is deferred without a
// promise: it is not sold at launch, so the copy below describes what is coming and nothing more
// (docs/phase-8-experts-connect-tracker.md).

export const COMING_SOON = "Coming soon";

export interface ComingSoonCopy {
  /** The page title, which is also the dock label. */
  title: string;
  /** One line of what this area will be for. */
  headline: string;
  status: string;
  /** What is not open yet, said plainly. No date, and nothing about price. */
  note: string;
  parts: readonly { name: string; line: string }[];
}

export const CONNECT_COMING_SOON: ComingSoonCopy = {
  title: "Connect",
  headline: "Talk to people who are already there, and keep what they tell you.",
  status: COMING_SOON,
  note: "Connect is not open yet. Nothing here is part of your kit today.",
  parts: [
    {
      name: "Who to ask",
      line: "The school's own channels, and the kind of person worth an hour of your time.",
    },
    {
      name: "A message you'd actually send",
      line: "A short draft in your words, to copy and send yourself.",
    },
    {
      name: "What you heard",
      line: "Notes from a conversation, by voice or typing, kept with your stories.",
    },
    {
      name: "Where it shows up",
      line: "What you learn can show in that school's essays, only if you say so.",
    },
  ],
};

export const TRACKER_COMING_SOON: ComingSoonCopy = {
  title: "Tracker",
  headline: "Every school, every piece, and what is still open.",
  status: COMING_SOON,
  note: "The tracker is not open yet. Your deadlines live on School Strategy until it opens.",
  parts: [
    {
      name: "One row per school",
      line: "Essays, forms, résumé, scores, transcripts, recommenders, the fee, submitted.",
    },
    { name: "Deadlines", line: "The round you chose, counted in your own days." },
    { name: "What to do next", line: "The few tasks that matter this week, in order." },
    { name: "Ready to submit", line: "What is still missing before you can send it." },
  ],
};
