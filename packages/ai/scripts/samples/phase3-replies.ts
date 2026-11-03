/**
 * Hand-authored model replies for the Phase 3 samples (phase3.ts), used only by the synthetic
 * recorder. Each is what a good answer to its sample looks like, citing only codes the sample
 * contains. Two samples have a first reply that breaks a post-parse rule, so the recordings also
 * exercise the repair turn: the Strategist plans the withheld story S05, and the Normalizer copies
 * third-party wording.
 */
import type { TaskOutput } from "../../src";
import { KB_NORMALIZE_OFFICIAL_INPUT, KB_NORMALIZE_THIRD_PARTY_INPUT } from "./phase3";

const spanOf = (text: string, needle: string) => {
  const start = text.indexOf(needle);
  if (start < 0) throw new Error(`"${needle}" is not in the sample source`);
  return { start, end: start + needle.length };
};

export const PROFILE_READ_REPLY: TaskOutput<"profile.read"> = {
  lenses: {
    academics: {
      helps: [
        {
          text: "A GMAT of 705 with Q50, and quantitative work a reader can see: tracing 80% of slow requests to three queries.",
          cites: ["F06", "S02"],
        },
      ],
      doubts: [],
      do: [
        {
          action: "Put the query analysis and its numbers on your resume, not only in an essay.",
          time_estimate: "1 hour",
          cites: ["S02"],
        },
      ],
    },
    self_awareness: {
      helps: [
        {
          text: "You own a real mistake plainly: the migration story names what you got wrong and what you changed.",
          cites: ["S04"],
        },
      ],
      doubts: [],
      do: [
        {
          action:
            "Write down, in two sentences, what the migration taught you that the night-shift fix confirmed.",
          time_estimate: "30 minutes",
          cites: ["S04", "S01"],
        },
      ],
    },
    employability: {
      helps: [
        {
          text: "You chose product work before applying: three days on the ward and two months arguing for a change.",
          cites: ["S06", "L004"],
        },
      ],
      doubts: [
        {
          flag_id: "FLAG-01",
          text: "Most of your evidence is engineering; a reader will look for business judgment in plain language.",
          cites: ["F02", "S01"],
        },
        {
          flag_id: "FLAG-03",
          text: "Meridian Health Systems will be unfamiliar to many readers, so its scale has to be stated.",
          cites: ["F01"],
        },
      ],
      do: [
        {
          action:
            "Talk to 3 product managers in health-data teams this month and note what they wish they had known.",
          time_estimate: "an evening a week for a month",
          cites: ["S06"],
        },
      ],
    },
    leadership: {
      helps: [
        {
          text: "You change minds with evidence: the rewrite was shelved after fifteen minutes of numbers.",
          cites: ["S02", "L002"],
        },
        {
          text: "You built something that runs without you: the Saturday class.",
          cites: ["S03", "F08"],
        },
      ],
      doubts: [
        {
          flag_id: "FLAG-02",
          text: "You coordinate four engineers but have no reports, so leadership has to show without a title.",
          cites: ["F03"],
        },
      ],
      do: [
        {
          action:
            "Ask your manager whether he will speak to the night-shift call and the incident note in his letter.",
          time_estimate: "30 minutes",
          cites: ["S01", "S04"],
        },
      ],
    },
  },
  strengthening_plan: [
    {
      action: "Talk to 3 people in your target role this month.",
      time_estimate: "an evening a week for a month",
      why: "Your goal is specific; conversations give you the first-hand reasons a goals essay needs.",
      cites: ["S06"],
    },
    {
      action:
        "State Meridian's scale in one line everywhere it appears: 40+ hospitals in India and the US.",
      time_estimate: "1 hour",
      why: "A reader who has not heard of the employer judges the role by the scale you give it.",
      cites: ["F01"],
    },
  ],
  brand_preview: [
    {
      trait: "brings_people_along",
      why: "You win arguments with evidence, not rank.",
      cites: ["S02", "S01"],
    },
    {
      trait: "commercial_judgment",
      why: "You ask what should be built, not only how.",
      cites: ["S06", "S02"],
    },
    {
      trait: "community_builder",
      why: "The Saturday class outlasted your own Saturdays.",
      cites: ["S03"],
    },
  ],
};

export const SCHOOL_FIT_REPLY: TaskOutput<"strategy.school_fit"> = {
  honest_flags: [
    {
      text: "Your target is product management; product and marketing took 19% of last year's class, behind consulting at 31%.",
      cites: ["K39"],
    },
    {
      text: "Most scholarship funds are committed by the end of Round 2, so Round 2 is your last round for funding here.",
      cites: ["K03"],
    },
  ],
  looks_for: [
    {
      school_value: "practical collaborator",
      your_traits: ["brings_people_along"],
      note: "Halvorsen wants the other people in the story shown by role.",
      cites: ["K25", "K27"],
    },
    {
      school_value: "accountable to a wider community",
      your_traits: ["community_builder"],
      note: "A direct match with sustained community work.",
      cites: ["K26"],
    },
  ],
  outcome_in_target_function: {
    text: "Product and marketing: 19% of the class of 2026, median base USD 150,000. The January technology trek visits product teams, and the product club prepares first-years for it.",
    cites: ["K39", "K38", "K900001"],
  },
};

const STRATEGIST_REPLY: TaskOutput<"kit.positioning_filemap"> = {
  positioning: {
    must_see: [
      {
        text: "A practical collaborator who leaves teams better than he found them, shown through the people around him.",
        cites: ["K25", "K27", "S02"],
      },
      {
        text: "A specific first role in product and a credible bridge from engineering to it.",
        cites: ["K07", "S06"],
      },
    ],
    lead_traits: [
      {
        trait: "brings_people_along",
        why: "Halvorsen's practical-collaborator value maps to it, and the rewrite story proves it with numbers.",
        cites: ["K27", "S02"],
      },
      {
        trait: "commercial_judgment",
        why: "It turns an engineer into a credible product hire for a reader checking employability.",
        cites: ["S06", "S02", "K07"],
      },
    ],
    red_flags: [
      {
        flag: "Deeply technical background (FLAG-01)",
        address_in: "essay",
        how: "The goals essay leads with the ward story in plain business language; one technical term at most.",
      },
      {
        flag: "No formal management title (FLAG-02)",
        address_in: "recommender",
        how: "The manager's letter covers the night-shift call and the incident note as leadership without authority.",
      },
    ],
    career_lane_check: {
      short_term: "Product manager on a health-data team, owning a clinical workflow.",
      realism:
        "Realistic but not the school's main lane: product and marketing took 19% of the class, and the January trek and product club give a path in.",
      plan_b: "Health-tech strategy consulting, which is Halvorsen's largest destination at 31%.",
      risks: [
        "Consulting recruiting starts in the first week, which can pull time from product preparation.",
      ],
      cites: ["K39", "K38", "K41", "K900001"],
    },
    reapplicant_angle: null,
  },
  file_map: {
    items: [
      {
        deliverable_key: "goals",
        primary_story: "S06",
        primary_reason_if_none: null,
        supporting: ["S01"],
        traits_shown: ["commercial_judgment", "curious_learner"],
        lenses: ["employability"],
        why: "The ward story is where the product goal started, which the goals prompt asks for.",
      },
      {
        deliverable_key: "shaped",
        primary_story: "S02",
        primary_reason_if_none: null,
        supporting: [],
        traits_shown: ["brings_people_along", "analytical"],
        lenses: ["leadership", "self_awareness"],
        why: "He changed how a group decided, and the reflection answers the prompt's second half.",
      },
      {
        deliverable_key: "optional",
        primary_story: null,
        primary_reason_if_none:
          "Nothing needs explaining: no gaps, and the test score is above the median.",
        supporting: [],
        traits_shown: [],
        lenses: [],
        why: "Halvorsen does not expect a third story here.",
      },
      {
        deliverable_key: "activities",
        primary_story: "S03",
        primary_reason_if_none: null,
        supporting: [],
        traits_shown: ["community_builder", "develops_people"],
        lenses: ["leadership"],
        why: "The Saturday class is the community entry, with time per month.",
      },
      {
        deliverable_key: "interview_resume",
        primary_story: "S01",
        primary_reason_if_none: null,
        supporting: ["S04"],
        traits_shown: ["delivers_under_pressure", "acts_on_feedback"],
        lenses: ["employability", "self_awareness"],
        why: "The resume walk-through needs one vivid moment and one honest one.",
      },
    ],
    recommender_plan: [
      {
        recommender_id: "R1",
        strengths: ["delivers_under_pressure", "acts_on_feedback"],
        stories: ["S01", "S04"],
        facets: [
          "Leadership without authority on the night-shift call",
          "How he handled the migration incident",
        ],
      },
      {
        recommender_id: "R2",
        strengths: ["commercial_judgment"],
        stories: ["S06"],
        facets: ["How he brought the nurses' workarounds to the product team"],
      },
    ],
    coverage_gaps: [
      "Academics rests on the test score and the resume; no essay carries it, so the resume must show the query analysis.",
    ],
    warnings: ["Only one recommender has seen his product work; brief R2 early."],
  },
};

/** First reply plans the withheld story S05 for the optional essay; the repair drops it. */
export const KIT_POSITIONING_REPLIES: TaskOutput<"kit.positioning_filemap">[] = [
  {
    ...STRATEGIST_REPLY,
    file_map: {
      ...STRATEGIST_REPLY.file_map,
      items: STRATEGIST_REPLY.file_map.items.map((item) =>
        item.deliverable_key === "optional"
          ? {
              ...item,
              primary_story: "S05",
              primary_reason_if_none: null,
              traits_shown: ["resilient"],
              lenses: ["self_awareness"],
              why: "Context for the year his work slipped.",
            }
          : item,
      ),
    },
  },
  STRATEGIST_REPLY,
];

export const KB_NORMALIZE_OFFICIAL_REPLY: TaskOutput<"kb.normalize"> = {
  proposals: [
    {
      field_path: "rounds[name=R2].deadline",
      proposed: JSON.stringify("2027-01-13"),
      current: JSON.stringify("2027-01-06"),
      conflict: true,
      confidence: 0.95,
      source_span: spanOf(
        KB_NORMALIZE_OFFICIAL_INPUT.source.text,
        "Round 2: applications due 13 January 2027",
      ),
      rewritten_in_own_words: false,
      note: "The official deadlines page now gives 13 January 2027 for Round 2; the pack has 6 January.",
    },
  ],
};

const THIRD_PARTY_SPAN = spanOf(
  KB_NORMALIZE_THIRD_PARTY_INPUT.source.text,
  "Halvorsen interviewers tend to probe how the applicant handled a disagreement with a manager",
);

/** First reply copies the third-party wording (§9.6); the repair rewrites it. */
export const KB_NORMALIZE_THIRD_PARTY_REPLIES: TaskOutput<"kb.normalize">[] = [
  {
    proposals: [
      {
        field_path: "interview.format_notes[+]",
        proposed: JSON.stringify({
          text: "Halvorsen interviewers tend to probe how the applicant handled a disagreement with a manager.",
        }),
        current: null,
        conflict: false,
        confidence: 0.4,
        source_span: THIRD_PARTY_SPAN,
        rewritten_in_own_words: false,
        note: "From a third-party guide.",
      },
    ],
  },
  {
    proposals: [
      {
        field_path: "interview.format_notes[+]",
        proposed: JSON.stringify({
          text: "Expect follow-up questions on a past disagreement with your manager; interviewers may return to it.",
        }),
        current: null,
        conflict: false,
        confidence: 0.4,
        source_span: THIRD_PARTY_SPAN,
        rewritten_in_own_words: true,
        note: "Admitstory's own wording of a third-party observation; needs a first-hand source before publishing.",
      },
    ],
  },
];

export const KB_REFRESH_CHECK_REPLY: TaskOutput<"kb.refresh_check"> = {
  changed: true,
  summary:
    "The Round 2 deadline moved from 6 January 2027 to 13 January 2027. The contact line at the bottom was reworded, which does not matter to applicants.",
  affected_fields: ["rounds[name=R2].deadline"],
};
