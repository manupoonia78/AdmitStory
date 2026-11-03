// Follow one sentence (direction §4.3): four chapters, one spoken sentence passing through four
// real screens. Statements are two author-set lines each.
//
// Interview practice is "Coming soon" (plan OVERRIDE): chapter 4 keeps the interview frame as a
// preview, labelled, and its paragraph says so in words.

import { COMING_SOON } from "./shared";

export const FOLLOW_HEADING = "Follow one sentence through AdmitStory";

export interface FollowChapter {
  id: "studio" | "story" | "essay" | "interview";
  statement: readonly [string, string];
  paragraph: string;
  /** What the frame shows, for screen readers (the frame itself is a picture of real UI). */
  frameLabel: string;
  /** A visible label beside the chapter number, for chapters not in the product yet. */
  label?: string;
}

export const FOLLOW_CHAPTERS: readonly FollowChapter[] = [
  {
    id: "studio",
    statement: ["You say it,", "once."],
    paragraph:
      "Story Studio asks one question at a time and listens. Talk for twenty minutes or two hours. Nothing is asked twice.",
    frameLabel:
      "Story Studio: the question on screen, and the applicant’s answer arriving as a live transcript.",
  },
  {
    id: "story",
    statement: ["It becomes", "a story."],
    paragraph:
      "Every story you tell is kept with its facts: who, when, what changed, the numbers. You check them once, and they stay the same everywhere.",
    frameLabel:
      "A story card, The night-shift fix, with its traits and three confirmed facts, and the spoken phrase lit.",
  },
  {
    id: "essay",
    statement: ["It opens", "your essay."],
    paragraph:
      "Drafts reuse your sentences where they’re good, and each one keeps a link to the moment you said it. Anything you haven’t told us becomes a question, never a guess.",
    frameLabel:
      "An essay sheet whose first line is the applicant’s sentence, with where it was said and one open question for them.",
  },
  {
    id: "interview",
    statement: ["It comes back", "in your interview."],
    paragraph:
      "Interview practice will be built from the same file, so the questions follow up on what you actually wrote. It’s coming soon, at no extra cost to kit owners.",
    frameLabel:
      "A preview of interview practice: a question that follows up on the essay, quoting it.",
    label: COMING_SOON,
  },
];

export function chapterPosition(index: number): string {
  return `${index + 1} of ${FOLLOW_CHAPTERS.length}`;
}

export const STUDIO_FRAME = {
  chapter: "Work",
  listening: "Listening",
} as const;

export const STORY_FRAME = {
  factsHeading: "Facts",
  confirmed: "Confirmed",
} as const;

export const ESSAY_FRAME = {
  header: "Essay 1 · first draft",
} as const;

export const INTERVIEW_FRAME = {
  from: "From your Essay 1",
  pointsHeading: "Talking points",
  points: [
    "Say what you’d set up before the go-live, not what went wrong.",
    "Name the runbook: it still exists.",
    "End on the team you want to build.",
  ],
} as const;
