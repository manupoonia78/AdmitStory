// Fake data for the Story Studio prototype (spec §16 Phase 0.5). Everything here belongs to one
// fictional applicant: a backend engineer at a fictional hospital network. No real person, school
// or employer is described.

import type { CoverageLens, StoryCardData } from "@admitstory/ui";
import type { SampleSegment } from "./sample-answer";

export type ChapterId =
  | "roots"
  | "education"
  | "work"
  | "beyond-work"
  | "turning-points"
  | "people-values"
  | "goals"
  | "schools"
  | "recommenders";

/** The nine chapters (spec §5.2), each opening on a question from the bank (Appendix B). */
export const CHAPTERS: readonly { id: ChapterId; label: string; question: string }[] = [
  {
    id: "roots",
    label: "Roots",
    question: "Let's start before your first job. Where did you grow up, and what was home like?",
  },
  {
    id: "education",
    label: "Education",
    question: "Why did you choose what you studied? The honest version, not the interview version.",
  },
  {
    id: "work",
    label: "Work",
    question:
      "You led the go-live with no manager in place. What was the moment you were most worried it would fail?",
  },
  {
    id: "beyond-work",
    label: "Beyond work",
    question: "Outside work, what do you spend real time on?",
  },
  {
    id: "turning-points",
    label: "Turning points",
    question: "Tell me about a time you got something genuinely wrong. What was your part in it?",
  },
  {
    id: "people-values",
    label: "People and values",
    question: "Who do you most want to be like? What exactly did you watch them do?",
  },
  {
    id: "goals",
    label: "Goals",
    question: "In the first job after your MBA, what do you want to be doing day to day?",
  },
  {
    id: "schools",
    label: "Schools",
    question: "Which schools are you considering, and what draws you to each?",
  },
  {
    id: "recommenders",
    label: "Recommenders",
    question: "Who has seen your best work up close, and for how long?",
  },
];

/** The chapter the prototype opens on, and the one the sample answer belongs to. */
export const SAMPLE_CHAPTER: ChapterId = "work";

/** The story the sample answer contains. */
export const NIGHT_SHIFT_FIX: StoryCardData = {
  id: "night-shift-fix",
  nickname: "The night-shift fix",
  era: "2024",
  context: "Work",
  traits: ["initiative", "ownership", "calm under pressure"],
  status: { tone: "needs", label: "Needs one number" },
  summary: "Wrote a replay queue at 2 a.m. so lab results reached the wards before morning rounds.",
};

/** A scripted answer to the Work question, segment by segment as speech-to-text would send it. */
export const SAMPLE_ANSWER: readonly SampleSegment[] = [
  { id: "sample-1", text: "It was 2 a.m. on the second night of the go-live," },
  { id: "sample-2", text: "and the lab feed was dropping every fourth result." },
  { id: "sample-3", text: "The vendor wouldn't pick up until nine." },
  {
    id: "sample-4",
    text: "So I wrote a small replay queue on the night shift and tested it on the last hour of traffic.",
    story: NIGHT_SHIFT_FIX,
  },
  { id: "sample-5", text: "By six it had caught every dropped result." },
];

/** The shelf before the sample answer: eight stories, so the capture makes nine. */
export const SHELF: readonly StoryCardData[] = [
  {
    id: "saturday-club",
    nickname: "Saturday coding club",
    era: "2019–2023",
    context: "Beyond work",
    traits: ["community", "teaching"],
    status: { tone: "verified", label: "Confirmed" },
  },
  {
    id: "vendor-no",
    nickname: "The vendor who said no",
    era: "2023",
    context: "Work",
    traits: ["persuasion", "ownership"],
    status: { tone: "neutral", label: "Draft" },
  },
  {
    id: "intern-stayed",
    nickname: "The intern who stayed",
    era: "2022",
    context: "Work",
    traits: ["developing others"],
    status: { tone: "neutral", label: "Draft" },
  },
  {
    id: "park",
    nickname: "Eight people in a park",
    era: "2021",
    context: "Beyond work",
    traits: ["community", "initiative"],
    status: { tone: "verified", label: "Confirmed" },
  },
  {
    id: "hackathon",
    nickname: "The hackathon we lost",
    era: "2016",
    context: "Education",
    traits: ["teamwork", "setback"],
    status: { tone: "needs", label: "Needs one number" },
  },
  {
    id: "warning",
    nickname: "The warning on my record",
    era: "2015",
    context: "Education",
    traits: ["self-awareness", "resilience"],
    status: { tone: "needs", label: "Needs a detail" },
  },
  {
    id: "ledger",
    nickname: "Grandmother's ledger",
    era: "2006",
    context: "Roots",
    traits: ["responsibility", "numeracy"],
    status: { tone: "verified", label: "Confirmed" },
  },
  {
    id: "two-languages",
    nickname: "Two languages at dinner",
    era: "2004–2010",
    context: "Roots",
    traits: ["cross-cultural"],
    status: { tone: "verified", label: "Confirmed" },
  },
];

/** Facts captured before the sample answer, and how many the night-shift story adds. */
export const BASE_FACTS = 58;
export const STORY_FACTS = 3;

export function coverageFor(hasNightShiftFix: boolean): CoverageLens[] {
  return [
    { id: "academics", level: "strong" },
    { id: "self-awareness", level: "thin", note: "no setback story yet" },
    { id: "employability", level: "partial", note: "numbers for one role only" },
    hasNightShiftFix
      ? { id: "leadership", level: "strong", note: "originated an idea under pressure" }
      : { id: "leadership", level: "partial", note: "no originated idea yet" },
    { id: "goals", level: "thin", note: "short-term role still vague" },
    { id: "school-fit", level: "none", note: "no schools chosen yet" },
  ];
}
