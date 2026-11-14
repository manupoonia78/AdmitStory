// The landing hero (SPEC §3). "Tell it once. Tell it well." is the product's mechanism in six
// words; nothing here promises an outcome. Every applicant below is fictional, and so is
// Northfield: the three already on this page (the night-shift analyst of ../_data/sample.ts, the
// product manager of ../_data/sample-words.ts, the family packaging business of
// ../_sections/app-preview.tsx), each quoted in their own existing words.

import { START_STORY } from "./shared";

export const HERO_COPY = {
  eyebrow: "MBA applications · in your own words",
  /** One array for every width: the two lines are equal, so phones break the same way. */
  headingLines: ["Tell it once.", "Tell it well."],
  /** The word set in the italic accent. */
  headingAccent: "well.",
  subline:
    "AdmitStories listens to your life story once, then drafts each school’s essays from it, shows its reasoning, and marks which words are yours.",
  primary: START_STORY,
  secondary: "See how it works",
  /** Read by screen readers in place of the decorative stage. */
  stageDescription:
    "A sample: a sentence a fictional applicant said becomes the opening of three Northfield essays, each with a note on why.",
  sampleNote: "Sample applicants · fictional, as is Northfield",
  pause: "Pause the sample",
  play: "Play the sample",
} as const;

/** The strip under the horizon: how it works, in three short facts. Not statistics. */
export const HERO_FACTS = [
  { lead: "You talk.", rest: "By voice or by typing, one question at a time." },
  { lead: "It drafts.", rest: "Every essay, one school at a time." },
  { lead: "You see why.", rest: "Each draft shows its reasoning and which words are yours." },
] as const;

export interface HeroSheet {
  /** The essay the sheet belongs to. */
  title: string;
  /** The margin note: why the draft is built this way. No word longer than ten characters. */
  note: string;
  /** The essay's opening. `said` is the applicant's own sentence, marked as theirs. */
  before?: string;
  said?: string;
  after: string;
  /** Words written against the prompt's limit. */
  count: { written: number; limit: number };
}

export interface HeroSample {
  /** Who is speaking, as a role. Never a name. */
  who: string;
  /** What they said, word for word. */
  sentence: string;
  /** Left to right in the fan; the third lies on top and carries the sentence. */
  sheets: readonly [HeroSheet, HeroSheet, HeroSheet];
}

const TITLES = ["Why Northfield", "Short-term goal", "A time you led"] as const;

export const HERO_SAMPLES: readonly HeroSample[] = [
  {
    who: "Hospital systems analyst",
    sentence: "It was 2 a.m. and the feed from the lab system was dropping every fourth message.",
    sheets: [
      {
        title: TITLES[0],
        note: "Opens on the ward at 2 a.m. The school asks about ownership, so it comes first.",
        after:
          "Northfield asks what I would bring to a team. I would bring the night the lab feed failed, and what I did before anyone asked me to.",
        count: { written: 212, limit: 250 },
      },
      {
        title: TITLES[1],
        note: "The goal grows out of that night: teams that never need the call.",
        after:
          "I want to lead clinical systems for a hospital group, and to build teams that never need that call.",
        count: { written: 96, limit: 100 },
      },
      {
        title: TITLES[2],
        note: "No title in this story. Kept: the phone list and the terrible coffee.",
        said: "It was 2 a.m. and the feed from the lab system was dropping every fourth message.",
        after:
          "Nobody on the ward could see it yet, but I could. What I did have was a phone list and a pot of terrible coffee.",
        count: { written: 187, limit: 200 },
      },
    ],
  },
  {
    who: "Fintech product manager",
    sentence: "Not one of them was angry. They had simply forgotten it was there.",
    sheets: [
      {
        title: TITLES[0],
        note: "Starts with the feature you shut down. Candour is what this prompt rewards.",
        after:
          "I am applying to Northfield a year after I ended my own project. It was the most useful thing I have done at work.",
        count: { written: 231, limit: 250 },
      },
      {
        title: TITLES[1],
        note: "The goal follows from the calls: products people come back to.",
        after:
          "I want to lead product at a payments company, and to build things people open a second time.",
        count: { written: 88, limit: 100 },
      },
      {
        title: TITLES[2],
        note: "Leading, here, is ending your own work. The week of calls is the proof.",
        before: "I spent a week calling the customers who had stopped using it, one by one.",
        said: "Not one of them was angry. They had simply forgotten it was there.",
        after: "That was harder to hear than any complaint.",
        count: { written: 194, limit: 200 },
      },
    ],
  },
  {
    who: "Family packaging business",
    sentence: "My father ran the plant from a notebook, and the notebook was always right.",
    sheets: [
      {
        title: TITLES[0],
        note: "Begins with the notebook, not the job title. It shows what you came to learn.",
        after:
          "I come to Northfield from a plant of 140 people and one notebook. I want to learn what a company needs after its founder.",
        count: { written: 224, limit: 250 },
      },
      {
        title: TITLES[1],
        note: "The goal is the next problem: a plant that runs without one memory.",
        after:
          "I want to take our packaging business from one plant to three, on systems anyone can read.",
        count: { written: 92, limit: 100 },
      },
      {
        title: TITLES[2],
        note: "Your line opens it. The year of “homework” is where you lead.",
        said: "My father ran the plant from a notebook, and the notebook was always right.",
        after:
          "I spent my first year moving the notebook into software nobody had asked for. The supervisors called it my homework.",
        count: { written: 176, limit: 200 },
      },
    ],
  },
];
