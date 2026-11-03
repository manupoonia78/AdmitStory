// /how-it-works (direction §6), verbatim where the direction gives the words. Sentence case, no
// "!", honest per spec §14.5.
//
// Deferrals (Manu, 2 Nov 2026): step 8 (interview practice) carries "Coming soon" and the promise
// line instead of "In your kit", and there's no expert mock (Phase 8 isn't sold at launch).

import { COMING_SOON, INTERVIEW_COMING_SOON_LINE } from "./shared";

export const HOW_COPY = {
  heading: ["From one conversation", "to every school."],
  assemblyLabel: "A sample kit assembling for Northfield",
  playAgain: "Play again",
  stagesHeading: "What the kit builds",
  deliverablesHeading: "What Northfield asks for",
  fromStory: "From the story",
  stepsHeading: "Eight steps, start to finish.",
  policiesHeading: "Each school’s AI policy",
  policiesLine:
    "We check each school’s AI policy on its own website every cycle, and follow it when drafting.",
  closeHeading: "What it won’t do.",
} as const;

export interface HowStep {
  id: string;
  heading: string;
  body: string;
  /** Right-aligned: the time it takes, "Free", "In your kit" or a price. */
  value: string;
  /** Which real-screen capture illustrates it, when one exists. */
  screen?: "dossier" | "profile-read" | "strategy" | "workspace" | "resume-pass";
}

export const HOW_STEPS: readonly HowStep[] = [
  {
    id: "tell",
    heading: "Tell your story.",
    body: "Story Studio interviews you by voice or typing, across nine chapters of your life and work. Choose an express, standard or deep session, and upload a résumé to skip what’s already on it.",
    value: "20–90 min, free",
  },
  {
    id: "facts",
    heading: "Check your facts once.",
    body: "The Dossier holds your stories with their facts. You confirm the numbers once, and the fact sheet stays identical across every school.",
    value: "Free",
    screen: "dossier",
  },
  {
    id: "read",
    heading: "See how you’ll be read.",
    body: "The Profile Read looks at your file through four lenses an admissions reader uses, then gives you a plan to strengthen it. No scores out of 100.",
    value: "Free",
    screen: "profile-read",
  },
  {
    id: "schools",
    heading: "Choose schools and rounds.",
    body: "School Strategy lays out deadlines and rounds, compares the class profile with yours in words, and flags what matters, with the source for each.",
    value: "Free",
    screen: "strategy",
  },
  {
    id: "unlock",
    heading: "Unlock a school.",
    body: "The kit builds that school’s positioning and file map, every essay and short answer with options and reasons, the form and your résumé.",
    value: "A few minutes, $100",
  },
  {
    id: "yours",
    heading: "Make each draft yours.",
    body: "In the Workspace your own words are lit, it asks you questions instead of guessing, and it checks facts, numbers and dates across the whole file as you refine.",
    value: "In your kit",
    screen: "workspace",
  },
  {
    id: "recommenders",
    heading: "Brief your recommenders.",
    body: "Each recommender gets a brief and a private page with the stories worth telling. They write their own letter.",
    value: "In your kit",
  },
  {
    id: "interview",
    heading: "Practise the interview.",
    body: `Drills and full voice mock interviews that follow up on what you wrote, with a report you can scrub through. ${INTERVIEW_COMING_SOON_LINE}`,
    value: COMING_SOON,
  },
];
