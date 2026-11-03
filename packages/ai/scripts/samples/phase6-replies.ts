/**
 * Hand-authored replies for the Phase 6 samples (phase6.ts), written from the fictional
 * engineer-to-product applicant's compact dossier and the intake answers in phase6.ts. Every fact,
 * number and name is in that material; nothing is invented (spec §0, §8.7).
 *
 * Three samples include a repair turn, so the recordings exercise §8.4 step 6:
 * - the first rec1 extraction adds a number the applicant never gave ("40%");
 * - the first plan gives both recommenders the same strength (LOR-03);
 * - the first rec1 brief cites a school pack line (K18) and a number not in the cited story;
 * - the first assisted answer adds a sentence that isn't in any of the recommender's notes.
 */
import type { LorBrief, LorIntake, LorPlan, RecommenderAssist } from "@admitstory/shared/kit";

/* lor.extract ---------------------------------------------------------------------------------- */

const REC1_NIGHT_SHIFT = {
  ref: "s1",
  title: "The night-shift fix",
  what_happened:
    "At the go-live at a 900-bed hospital, the lab feed dropped every fourth message at 2 a.m.",
  what_they_saw:
    "Ravi was on the call from home and watched him trace the fault and bring the vendor round.",
  your_actions: [
    "Found the retry logic re-sent whole batches",
    "Rewrote the retry per message and tested it on replayed traffic",
    "Persuaded the vendor's on-call engineer to widen the batch window from 30 to 90 seconds",
    "Wrote a runbook for the hospital's IT staff",
  ],
  result: "The go-live held, with no dropped messages in twenty months.",
  numbers: ["900-bed hospital", "30 to 90 seconds"],
  what_they_said: "You didn't wait for permission, and you were right not to.",
  traits: ["delivers_under_pressure", "brings_people_along"],
  cites: ["S01", "L001"],
} satisfies LorIntake["stories"][number];

const REC1_INTAKE_BASE = {
  relationship: {
    summary:
      "Ravi Menon has been his engineering manager at Meridian Health Systems for about four years, with a one-to-one every week.",
    chose_you_for:
      "Put him forward for the senior promotion two years early and asked for him by name to run the lab-feed go-live.",
    cites: ["F01", "F07"],
  },
  strengths: [
    {
      trait: "delivers_under_pressure",
      moment: "Stayed calm and found the fault at 2 a.m. during the go-live.",
      story_ref: "s1",
    },
    {
      trait: "brings_people_along",
      moment: "Got the vendor's engineer to change their batch window.",
      story_ref: "s1",
    },
    {
      trait: "acts_on_feedback",
      moment: "Changed how he plans migrations after Ravi's feedback.",
      story_ref: "s2",
    },
  ],
  growth: {
    feedback:
      "After the migration, Ravi said he should have asked someone to check his plan, and that he kept problems to himself until he had solved them.",
    response: "He was embarrassed but agreed.",
    steps: [
      "Every migration plan he writes now goes to a colleague for review first",
      "Added a schema check to every migration",
    ],
    evidence: "The schema check has blocked four migrations since.",
    cites: ["S04"],
  },
  said_to_others: ["In a 2024 review: 'the person the team calls when a go-live is in trouble'."],
  background: { knows_mba: "unknown", note: null },
  logistics: { prefers: null, remind_when: null },
  missing: [
    { question_id: "background", ask: "Has Ravi written an MBA recommendation before?" },
    {
      question_id: "logistics",
      ask: "How would Ravi like to get the brief, and when should you remind him?",
    },
  ],
} satisfies Omit<LorIntake, "stories">;

const REC1_OTHER_STORIES = [
  {
    ref: "s2",
    title: "The migration I got wrong",
    what_happened:
      "A migration he tested on an old copy corrupted about 1,100 appointment records.",
    what_they_saw: "Ravi was with him on the customer call and read the incident note he wrote.",
    your_actions: [
      "Restored the records from backup within two hours",
      "Wrote the incident note himself",
      "Added a schema check that has blocked four migrations since",
    ],
    result:
      "No appointments were permanently lost, and the schema check has blocked four migrations since.",
    numbers: ["about 1,100 appointment records"],
    what_they_said: null,
    traits: ["honest_about_limits", "acts_on_feedback"],
    cites: ["S04"],
  },
  {
    ref: "s3",
    title: "The runbook",
    what_happened:
      "After the go-live he wrote a runbook so the hospital's IT staff could run the feed without the engineers.",
    what_they_saw: "Ravi reviewed the runbook and made it the template for every go-live.",
    your_actions: ["Wrote a runbook for the hospital's IT staff"],
    result: "It became Meridian's template for every go-live.",
    numbers: [],
    what_they_said: null,
    traits: ["acts_unasked", "develops_people"],
    cites: ["S01"],
  },
] satisfies LorIntake["stories"];

export const LOR_EXTRACT_REC1_REPLIES: readonly LorIntake[] = [
  // First reply: a number the applicant never gave.
  {
    ...REC1_INTAKE_BASE,
    stories: [
      {
        ...REC1_NIGHT_SHIFT,
        result: "The go-live held and failed retries fell by 40%.",
      },
      ...REC1_OTHER_STORIES,
    ],
  },
  { ...REC1_INTAKE_BASE, stories: [REC1_NIGHT_SHIFT, ...REC1_OTHER_STORIES] },
];

export const LOR_EXTRACT_REC2_REPLY: LorIntake = {
  relationship: {
    summary:
      "Dr. Rao directs clinical informatics at the 900-bed hospital client and worked with him most weeks for about eight months.",
    chose_you_for: "Asked Meridian to keep him on her account after the go-live.",
    cites: ["F01"],
  },
  strengths: [
    {
      trait: "curious_learner",
      moment: "Sat with her nurses through a full shift to see how they used his screen.",
      story_ref: "s1",
    },
    {
      trait: "cross_functional_influence",
      moment: "Changed the product, not just the code, after the shift.",
      story_ref: "s1",
    },
  ],
  stories: [
    {
      ref: "s1",
      title: "The ward workaround",
      what_happened: "Nurses kept a paper workaround for a scheduling screen he built.",
      what_they_saw:
        "Dr. Rao saw him sit with her nurses through a full shift and come back with the field order changed.",
      your_actions: [
        "Sat with four nurses through a full shift and listed every workaround",
        "Took the list to the product team instead of patching the code",
        "Argued for two months to get the field order changed",
      ],
      result: "The screen changed and the paper workaround went away.",
      numbers: [],
      what_they_said: "Nobody from a vendor has ever sat a shift with us.",
      traits: ["curious_learner", "cross_functional_influence"],
      cites: ["S06", "L004"],
    },
    {
      ref: "s2",
      title: "The go-live runbook",
      what_happened:
        "At the go-live the lab feed dropped messages at 2 a.m., with her team on the call.",
      what_they_saw: "Her IT staff got a runbook from him after the go-live and still use it.",
      your_actions: ["Wrote a runbook for her IT staff after the go-live"],
      result: "Her team still uses the runbook.",
      numbers: [],
      what_they_said: null,
      traits: ["develops_people"],
      cites: ["S01"],
    },
  ],
  growth: null,
  said_to_others: ["Told the account manager she wanted him on every project with her hospital."],
  background: { knows_mba: "yes", note: "Has an MBA and has written letters for her own staff." },
  logistics: { prefers: "Email", remind_when: "Monday mornings" },
  missing: [
    {
      question_id: "feedback",
      ask: "What constructive feedback has Dr. Rao given you, and what did you do with it?",
    },
    {
      question_id: "stories",
      ask: "What else did Dr. Rao see you do herself? Three more stories would help.",
    },
  ],
};

/* lor.plan ------------------------------------------------------------------------------------- */

const REC1_ASSIGNMENT = {
  recommender: "rec1",
  strengths: ["delivers_under_pressure", "brings_people_along", "acts_on_feedback"],
  stories: ["R01", "R02", "R03"],
  facets: [
    {
      story: "R01",
      facet: "How he found the fault and brought the vendor round at 2 a.m.",
      evidence: "Widened the batch window from 30 to 90 seconds with the vendor's engineer.",
    },
    {
      story: "R02",
      facet: "How he took the migration feedback",
      evidence: "A schema check that has blocked four migrations since.",
    },
    {
      story: "R03",
      facet: "What he left behind after the go-live",
      evidence: "The runbook became Meridian's template for every go-live.",
    },
  ],
  avoid: [
    {
      story: "S02",
      facet: "Talking the director out of the rewrite",
      because: "essay",
      where: "Halvorsen Essay 2",
    },
  ],
} satisfies LorPlan["assignments"][number];

const REC2_ASSIGNMENT = {
  recommender: "rec2",
  strengths: ["curious_learner", "cross_functional_influence"],
  stories: ["R04", "R05"],
  facets: [
    {
      story: "R04",
      facet: "What the nurses' shift showed about how he listens to clinicians",
      evidence: "Sat with four nurses through a full shift and listed every workaround.",
    },
    {
      story: "R05",
      facet: "What her IT staff got from him after the go-live",
      evidence: "Her team still uses the runbook.",
    },
  ],
  avoid: [
    {
      story: "S06",
      facet: "Why he wants to move into product",
      because: "essay",
      where: "Halvorsen Essay 1",
    },
    {
      story: "R01",
      facet: "The go-live night itself",
      because: "other_recommender",
      where: "rec1",
    },
  ],
} satisfies LorPlan["assignments"][number];

/** The repaired plan; phase6.ts builds the brief inputs from its assignments. */
export const LOR_PLAN_REPLY: LorPlan = {
  assignments: [REC1_ASSIGNMENT, REC2_ASSIGNMENT],
  red_flags: [],
  warnings: ["Kavita has two stories so far. Five to seven would give her brief more to draw on."],
};

export const LOR_PLAN_REPLIES: readonly LorPlan[] = [
  // First reply: both recommenders get "brings people along".
  {
    ...LOR_PLAN_REPLY,
    assignments: [
      REC1_ASSIGNMENT,
      { ...REC2_ASSIGNMENT, strengths: ["curious_learner", "brings_people_along"] },
    ],
  },
  LOR_PLAN_REPLY,
];

/* lor.brief ------------------------------------------------------------------------------------ */

const REC1_C2_FAULT = {
  point:
    "Under pressure at the go-live, he found that the retry logic re-sent whole batches and rewrote it per message.",
  evidence: "The lab feed was dropping every fourth message at 2 a.m.; the go-live held.",
  trait: "delivers_under_pressure",
  story: "R01",
  facet: "How he found the fault at 2 a.m.",
  cites: ["R01", "S01"],
} satisfies LorBrief["schools"][number]["questions"][number]["talking_points"][number];

const rec1Brief = (
  faultPoint: LorBrief["schools"][number]["questions"][number]["talking_points"][number],
): LorBrief => ({
  cover_note:
    "Ravi, thank you for agreeing to write for me. You've seen my work longer than anyone, from the go-live night to the migration I got wrong, so you're the person I most wanted to ask. Below are the questions Halvorsen asks, with the moments that might help you remember. The deadline and how to submit are at the top. I'm happy to talk any time this week.",
  schools: [
    {
      school_cycle_id: "halvorsen-2026-27",
      questions: [
        {
          question_id: "c1",
          question_verbatim:
            "Please provide a brief description of your interaction with the applicant and, if applicable, the applicant's team.",
          talking_points: [
            {
              point:
                "Ravi has been his engineering manager at Meridian Health Systems for about four years; they meet every week.",
              evidence:
                "Ravi put him forward for the senior promotion two years ahead of the usual track.",
              trait: "acts_on_feedback",
              story: null,
              facet: "How long and how closely Ravi has seen his work",
              cites: ["F01", "F07"],
            },
            {
              point:
                "Ravi asked for him by name to run the lab-feed go-live at the 900-bed hospital.",
              evidence: "Ravi was on the call from home through the night.",
              trait: "delivers_under_pressure",
              story: "R01",
              facet: "Why Ravi trusted him with the go-live",
              cites: ["R01", "S01"],
            },
          ],
        },
        {
          question_id: "c2",
          question_verbatim:
            "How does the candidate's performance compare to those of other well-qualified individuals in similar roles? Please provide specific examples.",
          talking_points: [
            faultPoint,
            {
              point:
                "He persuaded the vendor's on-call engineer, who did not report to him, to widen the batch window.",
              evidence: "The window went from 30 to 90 seconds.",
              trait: "brings_people_along",
              story: "R01",
              facet: "How he brought the vendor round",
              cites: ["R01", "S01"],
            },
            {
              point:
                "After the go-live he wrote a runbook so the hospital's staff could run the feed without engineers.",
              evidence: "Ravi made it Meridian's template for every go-live.",
              trait: "acts_unasked",
              story: "R03",
              facet: "What he left behind after the go-live",
              cites: ["R03", "S01"],
            },
          ],
        },
        {
          question_id: "c3",
          question_verbatim:
            "Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.",
          talking_points: [
            {
              point:
                "After a migration corrupted about 1,100 appointment records, Ravi told him to have his plans checked before running them.",
              evidence:
                "He restored the records from backup within two hours and wrote the incident note himself.",
              trait: "acts_on_feedback",
              story: "R02",
              facet: "How he took the migration feedback",
              cites: ["R02", "S04"],
            },
            {
              point: "Every migration plan he writes now goes to a colleague for review first.",
              evidence: "The schema check he added has blocked four migrations since.",
              trait: "acts_on_feedback",
              story: "R02",
              facet: "What changed after the feedback",
              cites: ["R02", "S04"],
            },
          ],
        },
      ],
    },
  ],
  traits_to_reinforce: [
    {
      trait: "delivers_under_pressure",
      why: "Ravi saw him find the fault and hold the go-live at 2 a.m.",
      cites: ["R01"],
    },
    {
      trait: "brings_people_along",
      why: "He brought the vendor's engineer round without any authority over him.",
      cites: ["R01"],
    },
    {
      trait: "acts_on_feedback",
      why: "He changed how he plans migrations after Ravi's feedback.",
      cites: ["R02"],
    },
  ],
  other_recommender_covers: [
    "Dr. Rao covers how he listens to clinicians: the shift he spent with her nurses.",
    "She also covers what her IT staff got from the runbook.",
  ],
  development_arc: {
    feedback:
      "Ravi said he should have asked someone to check his migration plan before running it.",
    response: "He agreed, and wrote the incident note himself.",
    steps: [
      "Every migration plan now goes to a colleague for review first",
      "Added a schema check to every migration",
    ],
    evidence: "The schema check has blocked four migrations since.",
    cites: ["R02", "S04"],
  },
  key_facts: [
    {
      text: "Senior Software Engineer at Meridian Health Systems since April 2024",
      cites: ["F02"],
    },
    { text: "Coordinates 4 engineers, with no formal reports", cites: ["F03"] },
    { text: "Promoted two years ahead of the usual track", cites: ["F07"] },
  ],
});

export const LOR_BRIEF_REC1_REPLIES: readonly LorBrief[] = [
  // First reply: cites the school pack (K18) and a number no cited material has.
  rec1Brief({
    ...REC1_C2_FAULT,
    evidence: "His fix cut the time to recover from incidents by 60%; the go-live held.",
    cites: ["R01", "K18"],
  }),
  rec1Brief(REC1_C2_FAULT),
];

export const LOR_BRIEF_REC2_REPLY: LorBrief = {
  cover_note:
    "Dr. Rao, thank you for writing for me. You saw my work from the hospital's side, which nobody at Meridian can, and that is why I asked you. Marrowgate asks its own two questions; they are below, with the moments that might help. Marrowgate asks that recommenders write without AI help, so this page is only here to jog your memory. I'd be glad to talk whenever suits you.",
  schools: [
    {
      school_cycle_id: "marrowgate-2026-27",
      questions: [
        {
          question_id: "q1",
          question_verbatim:
            "How does the candidate's performance compare with that of peers in similar roles?",
          talking_points: [
            {
              point:
                "He sat with four of her nurses through a full shift to see how they used a screen he had built.",
              evidence: "He came back with a list of every paper workaround.",
              trait: "curious_learner",
              story: "R04",
              facet: "What the shift showed about how he learns from clinicians",
              cites: ["R04", "S06"],
            },
            {
              point:
                "He took the list to the product team instead of patching the code, and argued for two months to change the field order.",
              evidence: "The screen changed and the paper workaround went away.",
              trait: "cross_functional_influence",
              story: "R04",
              facet: "How he changed the product, not just the code",
              cites: ["R04", "S06"],
            },
            {
              point: "After the go-live he wrote a runbook for her IT staff.",
              evidence: "Her team still uses it.",
              trait: "develops_people",
              story: "R05",
              facet: "What her IT staff got from him after the go-live",
              cites: ["R05", "S01"],
            },
          ],
        },
        {
          question_id: "q2",
          question_verbatim:
            "Describe the most important piece of constructive feedback you have given the candidate and how they responded.",
          talking_points: [
            {
              point:
                "When her nurses found the screen slowed them down, he treated it as feedback on the product rather than a bug report.",
              evidence: "He listed every workaround from a full shift with four nurses.",
              trait: "curious_learner",
              story: "R04",
              facet: "How he took the nurses' complaints",
              cites: ["R04", "S06"],
            },
            {
              point:
                "He argued with his own product team for two months to get the nurses' change made.",
              evidence: "The field order changed and the workaround went away.",
              trait: "cross_functional_influence",
              story: "R04",
              facet: "How he followed through on the nurses' complaints",
              cites: ["R04"],
            },
          ],
        },
      ],
    },
  ],
  traits_to_reinforce: [
    {
      trait: "curious_learner",
      why: "He spent a full shift on the ward to learn how the screen was used.",
      cites: ["R04"],
    },
    {
      trait: "cross_functional_influence",
      why: "He changed the product team's plans for the nurses.",
      cites: ["R04"],
    },
  ],
  other_recommender_covers: [
    "Ravi Menon covers the go-live night and how he brought the vendor round.",
    "Ravi also covers the migration feedback and what changed after it.",
  ],
  development_arc: null,
  key_facts: [
    {
      text: "Senior Software Engineer at Meridian Health Systems since April 2024",
      cites: ["F02"],
    },
    {
      text: "Meridian's software runs in 40+ hospitals in India and the US",
      cites: ["F01"],
    },
  ],
};

/* lor.recommender_assist ----------------------------------------------------------------------- */

const ASSIST_OUTLINE: RecommenderAssist["outline"] = [
  {
    beat: "How long and how closely you've seen his work",
    your_notes: ["N1"],
    questions: ["How many engineers like him have you managed?"],
  },
  {
    beat: "A moment that shows how he compares",
    your_notes: ["N2", "N3"],
    questions: ["What did other engineers at his level do in similar incidents?"],
  },
  { beat: "What he left behind", your_notes: ["N4"], questions: [] },
];

const ASSIST_PARAGRAPHS = [
  {
    sentences: [
      { text: "I've managed Arjun for four years.", kind: "verbatim", notes: ["N1"] },
      {
        text: "Compared with the other senior engineers I manage, he is the one who looks past the ticket to what the customer needs.",
        kind: "verbatim",
        notes: ["N3"],
      },
    ],
  },
  {
    sentences: [
      {
        text: "At the hospital go-live the lab feed was dropping messages at 2 a.m.",
        kind: "verbatim",
        notes: ["N2"],
      },
      {
        text: "Arjun found the retry bug, fixed it, and talked the vendor's engineer into changing their batch window.",
        kind: "verbatim",
        notes: ["N2"],
      },
      {
        text: "Most engineers at his level would have escalated and waited.",
        kind: "verbatim",
        notes: ["N2"],
      },
      {
        text: "He wrote the runbook after that go-live, and we now use it as our template.",
        kind: "adapted",
        notes: ["N4"],
      },
    ],
  },
  {
    sentences: [
      {
        text: "He is the person the team calls when a go-live is in trouble.",
        kind: "verbatim",
        notes: ["N1"],
      },
    ],
  },
] satisfies NonNullable<RecommenderAssist["answer"]>["paragraphs"];

const ASSIST_MISSING = [
  "A second example of how he compares with peers, from a different project.",
];

export const ASSIST_REPLIES: readonly RecommenderAssist[] = [
  // First reply: a sentence of the assistant's own, in nobody's notes.
  {
    answer: {
      paragraphs: [
        ...ASSIST_PARAGRAPHS,
        {
          sentences: [
            {
              text: "His leadership transformed our engineering culture and set a new standard for the whole company.",
              kind: "adapted",
              notes: ["N3"],
            },
          ],
        },
      ],
    },
    outline: ASSIST_OUTLINE,
    missing: ASSIST_MISSING,
  },
  { answer: { paragraphs: ASSIST_PARAGRAPHS }, outline: ASSIST_OUTLINE, missing: ASSIST_MISSING },
];

export const ASSIST_COACH_REPLY: RecommenderAssist = {
  answer: null,
  outline: [
    {
      beat: "The situation and the feedback you gave",
      your_notes: ["N2"],
      questions: [
        "What exactly did you tell him about the screen?",
        "What was at stake for your nurses?",
      ],
    },
    {
      beat: "How he responded",
      your_notes: ["N1", "N2"],
      questions: ["What did he do in the days after you told him?"],
    },
    {
      beat: "What changed",
      your_notes: [],
      questions: ["How do you know it got better for your nurses?"],
    },
  ],
  missing: ["What changed for your nurses afterwards."],
};
