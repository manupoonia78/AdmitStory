/**
 * Fixed inputs for the Phase 6 tasks (lor.extract, lor.plan, lor.brief, lor.recommender_assist),
 * shared by the synthetic recorder (record-phase6.ts) and check-tasks. Everything is fictional
 * (spec §0): the applicant is the `engineer-to-product` fixture (the Phase 3 compact dossier, first
 * name "Arjun" here), recommender rec1 is Ravi Menon (his engineering manager, P1 in the dossier)
 * and rec2 is Dr. Kavita Rao (director of clinical informatics at the fictional 900-bed hospital
 * client, Northgate Teaching Hospital). Schools are the fictional Halvorsen (common form) and
 * Marrowgate (its own questions, AI prohibited for recommendations) packs.
 *
 * Changing any value here changes a request hash: re-run `pnpm --filter @admitstory/ai
 * record:phase6 --synthetic` afterwards.
 */
import { COMMON_LOR_QUESTIONS } from "@admitstory/shared/kit";
import type { RunContext, TaskInput } from "../../src";
import { ENGINEER_DOSSIER } from "./phase3";
import { LOR_PLAN_REPLY } from "./phase6-replies";

export const PHASE6_CTX: RunContext = { dossier: ENGINEER_DOSSIER };
/** The portal assistant sees no dossier and logs no content (decision 20). */
export const PORTAL_CTX: RunContext = { contentLoggingAllowed: false };

export const APPLICANT_FIRST_NAME = "Arjun";

const RAVI = {
  ref: "rec1",
  name: "Ravi Menon",
  relationship: "manager",
  title: "Engineering manager",
  organisation: "Meridian Health Systems",
} as const;

const KAVITA = {
  ref: "rec2",
  name: "Dr. Kavita Rao",
  relationship: "client",
  title: "Director of clinical informatics",
  organisation: "Northgate Teaching Hospital",
} as const;

/* lor.extract ---------------------------------------------------------------------------------- */

export const LOR_EXTRACT_REC1_INPUT: TaskInput<"lor.extract"> = {
  recommender: RAVI,
  answers: [
    {
      question_id: "how_you_know",
      text: "Ravi has been my engineering manager at Meridian since 2021, about four years. We have a one-to-one every week and he sits in on our planning. In 2024 he put me forward for the senior promotion two years early, and he asked for me by name to run the lab-feed go-live at the 900-bed hospital.",
    },
    {
      question_id: "strengths",
      text: "He'd say I stay calm when things break and that I bring people along who don't report to me. He saw the first at the go-live at 2 a.m., and the second when I got the vendor's engineer to change their batch window.",
    },
    {
      question_id: "stories",
      text: "The night-shift fix. At the go-live the lab feed dropped every fourth message at 2 a.m. Ravi was on the call from home. I found the retry logic re-sent whole batches, rewrote it per message, tested it on replayed traffic, and persuaded the vendor's on-call engineer to widen the batch window from 30 to 90 seconds. I also wrote a runbook for the hospital's IT staff. The go-live held and we've had no dropped messages in twenty months. Ravi said at the time: 'You didn't wait for permission, and you were right not to.'",
    },
    {
      question_id: "stories",
      text: "The migration I got wrong. In 2022 a migration I tested on an old copy corrupted about 1,100 appointment records. Ravi was with me on the customer call. I restored from backup within two hours, wrote the incident note myself, and added a schema check that has blocked four migrations since.",
    },
    {
      question_id: "stories",
      text: "The runbook. After the go-live I wrote a runbook so the hospital's IT staff could run the feed without us. Ravi reviewed it and made it Meridian's template for every go-live.",
    },
    {
      question_id: "feedback",
      text: "After the migration Ravi told me I should have asked someone to check my plan, and that I keep problems to myself until I've solved them. I was embarrassed but he was right. Since then every migration plan I write goes to a colleague for review first, and the schema check I added has blocked four migrations.",
    },
    {
      question_id: "said_to_others",
      text: "In my 2024 review Ravi wrote that I am 'the person the team calls when a go-live is in trouble'.",
    },
  ],
  confirmed: [],
};

export const LOR_EXTRACT_REC2_INPUT: TaskInput<"lor.extract"> = {
  recommender: KAVITA,
  answers: [
    {
      question_id: "how_you_know",
      text: "Dr. Rao is the director of clinical informatics at the 900-bed hospital where we went live in 2024. I worked with her team for about eight months, most weeks, through the go-live and the nurse scheduling screen. She asked Meridian to keep me on her account after the go-live.",
    },
    {
      question_id: "strengths",
      text: "She'd say I listen to clinicians and that I change the product, not just the code. She saw it when I sat with her nurses through a full shift.",
    },
    {
      question_id: "stories",
      text: "The ward workaround. Her nurses kept a paper workaround for a scheduling screen I built. I sat with four nurses through a full shift and listed every workaround, then took the list to our product team instead of patching the code, and argued for two months to get the field order changed. The screen changed and the paper workaround went away. Dr. Rao said: 'Nobody from a vendor has ever sat a shift with us.'",
    },
    {
      question_id: "stories",
      text: "The go-live night. Her team was on the go-live call when the lab feed dropped messages at 2 a.m. I wrote a runbook for her IT staff afterwards, and her team still uses it.",
    },
    {
      question_id: "said_to_others",
      text: "She told our account manager she wanted me on every project with her hospital.",
    },
    {
      question_id: "background",
      text: "She has an MBA herself and has written letters for her own staff.",
    },
    { question_id: "logistics", text: "She prefers email, and a reminder on Monday mornings." },
  ],
  confirmed: [],
};

/* lor.plan ------------------------------------------------------------------------------------- */

export const LOR_PLAN_INPUT: TaskInput<"lor.plan"> = {
  recommenders: [
    {
      ref: "rec1",
      relationship: "manager",
      title: "Engineering manager",
      duration: "About four years",
      frequency: "Weekly one-to-one",
      strengths: ["delivers_under_pressure", "brings_people_along", "acts_on_feedback"],
      stories: [
        {
          code: "R01",
          title: "The night-shift fix",
          traits: ["delivers_under_pressure", "brings_people_along"],
          cites: ["S01", "L001"],
        },
        {
          code: "R02",
          title: "The migration I got wrong",
          traits: ["honest_about_limits", "acts_on_feedback"],
          cites: ["S04"],
        },
        {
          code: "R03",
          title: "The runbook",
          traits: ["acts_unasked", "develops_people"],
          cites: ["S01"],
        },
      ],
    },
    {
      ref: "rec2",
      relationship: "client",
      title: "Director of clinical informatics",
      duration: "About eight months",
      frequency: "Most weeks",
      strengths: ["curious_learner", "cross_functional_influence"],
      stories: [
        {
          code: "R04",
          title: "The ward workaround",
          traits: ["curious_learner", "cross_functional_influence"],
          cites: ["S06", "L004"],
        },
        {
          code: "R05",
          title: "The go-live runbook",
          traits: ["develops_people"],
          cites: ["S01"],
        },
      ],
    },
  ],
  essays: [
    {
      school: "Halvorsen",
      key: "goals",
      title: "Essay 1",
      primary_story: "S06",
      traits_shown: ["curious_learner", "commercial_judgment"],
    },
    {
      school: "Halvorsen",
      key: "shaped",
      title: "Essay 2",
      primary_story: "S02",
      traits_shown: ["brings_people_along", "analytical"],
    },
  ],
  kit_plans: [],
  red_flags: [],
};

/* lor.brief ------------------------------------------------------------------------------------ */

const REC1_STORIES: TaskInput<"lor.brief">["stories"] = [
  {
    code: "R01",
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
  },
  {
    code: "R02",
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
    code: "R03",
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
];

const REC2_STORIES: TaskInput<"lor.brief">["stories"] = [
  {
    code: "R04",
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
    code: "R05",
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
];

const [REC1_ASSIGNMENT, REC2_ASSIGNMENT] = LOR_PLAN_REPLY.assignments;
if (!REC1_ASSIGNMENT || !REC2_ASSIGNMENT)
  throw new Error("phase6: the plan reply has two assignments");

/** Halvorsen uses the common form: the brief answers COMMON_LOR_QUESTIONS (decision 16). */
export const LOR_BRIEF_REC1_INPUT: TaskInput<"lor.brief"> = {
  recommender: {
    ...RAVI,
    duration: "About four years",
    frequency: "Weekly one-to-one",
    knows_mba: "no",
  },
  applicant_first_name: APPLICANT_FIRST_NAME,
  schools: [
    {
      school_cycle_id: "halvorsen-2026-27",
      school: "Halvorsen",
      questions: COMMON_LOR_QUESTIONS.map((q) => ({ id: q.id, text_verbatim: q.text })),
    },
  ],
  assignment: REC1_ASSIGNMENT,
  others: [
    {
      ref: "rec2",
      relationship: "client",
      strengths: REC2_ASSIGNMENT.strengths,
      facets: REC2_ASSIGNMENT.facets.map((f) => f.facet),
    },
  ],
  stories: REC1_STORIES,
  relationship_note: {
    summary:
      "Ravi Menon has been his engineering manager at Meridian Health Systems for about four years, with a one-to-one every week.",
    chose_you_for:
      "Put him forward for the senior promotion two years early and asked for him by name to run the lab-feed go-live.",
    cites: ["F01", "F07"],
  },
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
  red_flags: [],
  is_reapplicant: false,
};

/** Marrowgate asks its own two questions (pack K14), so it has a brief of its own. */
export const LOR_BRIEF_REC2_INPUT: TaskInput<"lor.brief"> = {
  recommender: {
    ...KAVITA,
    duration: "About eight months",
    frequency: "Most weeks",
    knows_mba: "yes",
  },
  applicant_first_name: APPLICANT_FIRST_NAME,
  schools: [
    {
      school_cycle_id: "marrowgate-2026-27",
      school: "Marrowgate School of Business",
      questions: [
        {
          id: "q1",
          text_verbatim:
            "How does the candidate's performance compare with that of peers in similar roles?",
        },
        {
          id: "q2",
          text_verbatim:
            "Describe the most important piece of constructive feedback you have given the candidate and how they responded.",
        },
      ],
    },
  ],
  assignment: REC2_ASSIGNMENT,
  others: [
    {
      ref: "rec1",
      relationship: "manager",
      strengths: REC1_ASSIGNMENT.strengths,
      facets: REC1_ASSIGNMENT.facets.map((f) => f.facet),
    },
  ],
  stories: REC2_STORIES,
  relationship_note: {
    summary:
      "Dr. Rao directs clinical informatics at the 900-bed hospital client and worked with him most weeks for about eight months.",
    chose_you_for: "Asked Meridian to keep him on her account after the go-live.",
    cites: ["F01"],
  },
  growth: null,
  red_flags: [],
  is_reapplicant: false,
};

/* lor.recommender_assist ----------------------------------------------------------------------- */

const COMMON_Q2 = COMMON_LOR_QUESTIONS[1];
if (!COMMON_Q2) throw new Error("phase6: COMMON_LOR_QUESTIONS has a second question");

/** Ravi's own notes on the common form's comparison question; Halvorsen allows AI help. */
export const ASSIST_INPUT: TaskInput<"lor.recommender_assist"> = {
  mode: "assist",
  question: {
    text_verbatim: COMMON_Q2.text,
    limit: { kind: "words", value: COMMON_Q2.words ?? 500 },
  },
  notes: [
    {
      id: "N1",
      text: "I've managed Arjun for four years. He is the person the team calls when a go-live is in trouble.",
    },
    {
      id: "N2",
      text: "At the hospital go-live the lab feed was dropping messages at 2 a.m. Arjun found the retry bug, fixed it, and talked the vendor's engineer into changing their batch window. Most engineers at his level would have escalated and waited.",
    },
    {
      id: "N3",
      text: "Compared with the other senior engineers I manage, he is the one who looks past the ticket to what the customer needs.",
    },
    {
      id: "N4",
      text: "He wrote the runbook after that go-live and we now use it as our template.",
    },
  ],
  voice_card: "Short plain sentences, first person, some contractions.",
  brief_points: [
    "He persuaded the vendor's on-call engineer, who did not report to him, to widen the batch window.",
    "After the go-live he wrote a runbook so the hospital's staff could run the feed without engineers.",
  ],
  applicant_first_name: APPLICANT_FIRST_NAME,
  relationship: "manager",
};

/** Kavita on Marrowgate's feedback question: Marrowgate prohibits AI help, so coach mode. */
export const ASSIST_COACH_INPUT: TaskInput<"lor.recommender_assist"> = {
  mode: "coach",
  question: {
    text_verbatim:
      "Describe the most important piece of constructive feedback you have given the candidate and how they responded.",
    limit: { kind: "words", value: 300 },
  },
  notes: [
    {
      id: "N1",
      text: "Arjun sat a full shift with four of my nurses. Nobody from a vendor has ever done that.",
    },
    {
      id: "N2",
      text: "When I told him the screen was slowing my nurses down, he did not argue. He came back with a list.",
    },
  ],
  voice_card: "Measured, formal sentences; opens with the person.",
  brief_points: [],
  applicant_first_name: APPLICANT_FIRST_NAME,
  relationship: "client",
};
