// Fake data for the route transitions prototype (spec §16 Phase 0.5): six stories from one
// fictional applicant's shelf. No real person, employer or school appears here (spec §0);
// "Northfield School of Management" is invented.

export interface Story {
  /** Also the URL segment and the base of each view transition name, so a plain CSS ident. */
  id: string;
  title: string;
  context: "Roots" | "Education" | "Work" | "Beyond work";
  year: number;
  /** A golden line: the applicant's own words, shown with the your-words glow. */
  line: string;
  traits: string[];
  situation: string;
  action: string;
  result: string;
  reflection: string;
  usedIn: string;
}

export const FICTIONAL_SCHOOL = "Northfield School of Management";

export const STORIES: readonly Story[] = [
  {
    id: "night-shift-fix",
    title: "The night-shift fix",
    context: "Work",
    year: 2024,
    line: "It was 2 a.m., the lab feed was dropping every fourth message, and nobody else was awake to decide.",
    traits: ["initiative", "impact"],
    situation:
      "A new lab system went live across three wards while the manager's post was empty. On the first night, results stopped reaching the doctors' screens.",
    action:
      "I traced the gap to a message queue that dropped every fourth result, rerouted the feed through the old interface and called the vendor's on-call engineer with the logs.",
    result:
      "Results flowed again within 40 minutes. The fix became the standard fallback, and the go-live finished a week early.",
    reflection:
      "I learned that waiting for permission can be its own decision, and usually the wrong one.",
    usedIn: `${FICTIONAL_SCHOOL}, Essay 1`,
  },
  {
    id: "eight-people-in-a-park",
    title: "Eight people in a park",
    context: "Beyond work",
    year: 2021,
    line: "The first Saturday it was eight of us, a borrowed speaker and a bag of oranges.",
    traits: ["community", "persistence"],
    situation:
      "After the lockdowns, the older people on my street had stopped going out. The park two blocks away sat empty every weekend.",
    action:
      "I printed a notice for a slow Saturday walk, knocked on doors, and kept showing up when only two people came in the second week.",
    result:
      "Within a year, sixty people walked most Saturdays, and the residents' group took it over.",
    reflection:
      "Small and regular beat big and occasional. People came back because it was always there.",
    usedIn: `${FICTIONAL_SCHOOL}, Essay 2`,
  },
  {
    id: "warning-on-my-record",
    title: "The warning on my record",
    context: "Education",
    year: 2015,
    line: "I read the letter twice before I understood it was about me.",
    traits: ["self-awareness", "growth"],
    situation:
      "In my second year at university I failed two exams and received a formal academic warning.",
    action:
      "I asked my tutor to go through every mark with me, rebuilt my week around the subjects I had avoided, and joined a study group I had laughed at a year before.",
    result: "The next year I finished in the top tenth of the class.",
    reflection:
      "The warning is still on my transcript. I would rather explain it than pretend it isn't there.",
    usedIn: `${FICTIONAL_SCHOOL}, optional essay`,
  },
  {
    id: "hospital-onboarding",
    title: "The hospital onboarding",
    context: "Work",
    year: 2023,
    line: "Nobody had asked the nurses what the old system got right.",
    traits: ["leadership", "empathy"],
    situation:
      "Our team was replacing a twenty-year-old scheduling system that the nurses relied on and the managers disliked.",
    action:
      "I spent two weeks on night shifts with the nurses, wrote down every workaround they used, and made the five most important ones part of the new design.",
    result:
      "Adoption reached nine in ten staff in a month, against a target of six in ten in three.",
    reflection: "The people closest to the work had already solved half the problem.",
    usedIn: `${FICTIONAL_SCHOOL}, short answer 1`,
  },
  {
    id: "closing-the-shop",
    title: "Closing my grandmother's shop",
    context: "Roots",
    year: 2012,
    line: "I counted the till every night that summer, and the numbers never lied to me.",
    traits: ["responsibility", "judgement"],
    situation:
      "When I was seventeen, my grandmother's corner shop was losing money and she was too unwell to run it.",
    action:
      "I ran it for the summer, kept a ledger of every sale, and showed my family that the shop could not cover its rent.",
    result: "We sold the stock, paid every supplier in full and closed it with her blessing.",
    reflection:
      "It was the first time I saw that care and honesty about numbers can be the same thing.",
    usedIn: `${FICTIONAL_SCHOOL}, Essay 1 (alternative)`,
  },
  {
    id: "the-market-we-got-wrong",
    title: "The market we got wrong",
    context: "Work",
    year: 2022,
    line: "We had a beautiful model of a customer who didn't exist.",
    traits: ["analysis", "humility"],
    situation:
      "I led the market sizing for a new product line. The model said the opportunity was large, and leadership approved a pilot.",
    action:
      "When the pilot stalled, I went back to forty of the customers we had assumed existed, found most didn't, and presented the mistake myself.",
    result:
      "We stopped the pilot early and moved the budget to a smaller market that grew threefold.",
    reflection: "I now test the riskiest assumption first, before I build anything on top of it.",
    usedIn: `${FICTIONAL_SCHOOL}, interview plan`,
  },
];

export function getStory(id: string): Story | undefined {
  return STORIES.find((story) => story.id === id);
}

/** The view transition name of one part of a story, the same on the shelf and its page. */
export function storyTransitionName(id: string, part: "surface" | "title" | "line"): string {
  return `story-${id}-${part}`;
}

/** Transition types the two pages tag their links with (Link `transitionTypes`). */
export const STORY_OPEN = "story-open";
export const STORY_CLOSE = "story-close";
