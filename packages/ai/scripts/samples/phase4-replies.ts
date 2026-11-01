/**
 * Hand-authored model replies for the Phase 4 samples (phase4.ts), used only by the synthetic
 * recorder. Each is what a good answer looks like, built only from the engineer-to-product
 * dossier and the fictional Halvorsen and Kestrel Lake packs. Three samples have a first reply that
 * breaks a post-parse rule, so the recordings also exercise the repair turn:
 *
 * - kit.draft: a composed sentence states two numbers with no source (unsupported claim);
 * - kit.shortform: the one-word answer runs over its 150-character limit;
 * - draft.revise: a patch touches the paragraph the applicant edited by hand.
 */
import type { TaskOutput } from "../../src";
import { GOALS_ANGLE_A, SHAPED_ANGLE_A, SHAPED_DRAFT } from "./phase4";

const S = (text: string, kind: "verbatim" | "adapted" | "composed", sources: string[]) => ({
  text,
  kind,
  sources,
});

export const KIT_GAPS_REPLY: TaskOutput<"kit.gaps"> = {
  gaps: [
    {
      question: "What did you find out when you finally asked why the director wanted the rewrite?",
      blocking: true,
      deliverable_key: "shaped",
      story: "S02",
      approx_words: 30,
      why: "The second half of the prompt turns on what you learned, and the dossier only says you had not asked.",
    },
    {
      question: "What did the nurses' paper workaround look like, and what did it ask them to do?",
      blocking: true,
      deliverable_key: "goals",
      story: "S06",
      approx_words: 30,
      why: "The goals essay opens on the ward, and the scene needs one concrete detail only you saw.",
    },
    {
      question: "What have you changed or argued for in the product reviews you have sat in since?",
      blocking: false,
      deliverable_key: "goals",
      story: "S06",
      approx_words: 40,
      why: "One example shows the move into product has already started.",
    },
    {
      question: "How many hours a month does the Saturday class take you now?",
      blocking: false,
      deliverable_key: "activities",
      story: "S03",
      approx_words: 10,
      why: "The form asks for the time committed per month for each entry.",
    },
  ],
};

export const KIT_ANGLES_REPLY: TaskOutput<"kit.angles"> = {
  angles: [
    GOALS_ANGLE_A,
    {
      deliverable_key: "goals",
      label: "B",
      pitch:
        "Start from the Saturday class, where the barrier was confidence and not computers, and reach the ward as the same lesson at work.",
      opening_line: "Two of my first four students had never used a keyboard.",
      stories: ["S03", "S06"],
      beats: [
        { beat: "The Saturday class and the rewritten curriculum", words: 110, sources: ["S03"] },
        {
          beat: "The ward: the same mistake in software he built",
          words: 110,
          sources: ["S06", "L004"],
        },
        { beat: "The role five years out", words: 110, sources: ["S06"] },
        {
          beat: "What Halvorsen closes, with two named resources",
          words: 120,
          sources: ["K30", "K38"],
        },
      ],
      proves: ["community_builder", "commercial_judgment"],
      risks: [
        "Uses the community story that the activities entry already carries.",
        "Slower to reach the goal; the first role arrives after 220 words.",
      ],
      recommended: false,
      reason:
        "Warmer, but it spends the community story and reaches the goal late, where readers look for it early.",
    },
    SHAPED_ANGLE_A,
    {
      deliverable_key: "shaped",
      label: "B",
      pitch:
        "Open on the question he did not ask, and use the migration he got wrong as the earlier version of the same blind spot.",
      opening_line: "I built my case against the rewrite before I asked why anyone wanted it.",
      stories: ["S02", "S04"],
      beats: [
        { beat: "The case he built before asking", words: 80, sources: ["S02"] },
        {
          beat: "The migration: not asking anyone to check his plan",
          words: 100,
          sources: ["S04"],
        },
        { beat: "The meeting: numbers and a trade", words: 100, sources: ["S02", "L002"] },
        { beat: "What changed: asking first", words: 90, sources: ["S02", "S04"] },
      ],
      proves: ["self_aware", "brings_people_along"],
      risks: ["Two stories in 400 words leaves little room for either scene."],
      recommended: false,
      reason:
        "More self-aware, but the migration belongs to the interview walk-through, and two scenes thin out the change the prompt asks for.",
    },
  ],
  single_angle: [],
};

/** First reply: the page-load sentence is composed and cites nothing. The repair cites S02. */
export const KIT_DRAFT_REPLIES: TaskOutput<"kit.draft">[] = [
  {
    draft: {
      ...SHAPED_DRAFT,
      paragraphs: SHAPED_DRAFT.paragraphs.map((p) =>
        p.id === "p3"
          ? {
              ...p,
              sentences: p.sentences.map((s, i) =>
                i === 1 ? { ...s, kind: "composed" as const, sources: [] } : s,
              ),
            }
          : p,
      ),
    },
    coach: null,
  },
  { draft: SHAPED_DRAFT, coach: null },
];

export const KIT_DRAFT_COACH_REPLY: TaskOutput<"kit.draft"> = {
  draft: null,
  coach: {
    beats: [
      {
        beat: GOALS_ANGLE_A.beats[0]!.beat,
        words: 110,
        your_lines: [
          { text: "It was working exactly as specified, and it was still wrong.", source: "L004" },
        ],
        questions: [
          "What did the nurses' paper workaround look like, and when in their shift did they reach for it?",
          "What did you notice first, sitting with them through the shift?",
        ],
      },
      {
        beat: GOALS_ANGLE_A.beats[1]!.beat,
        words: 90,
        your_lines: [],
        questions: [
          "Why did you take the list to the product team instead of fixing the screen yourself?",
          "What did the two months of arguing for the change involve?",
        ],
      },
      {
        beat: GOALS_ANGLE_A.beats[2]!.beat,
        words: 110,
        your_lines: [],
        questions: [
          "Which clinical workflow would you most want to own, and why that one?",
          "What would a good first year in that role look like to you?",
        ],
      },
      {
        beat: GOALS_ANGLE_A.beats[3]!.beat,
        words: 120,
        your_lines: [],
        questions: [
          "Which skill do you most lack for that role: pricing, a budget, or a plan carried to a board?",
          "Which one or two Halvorsen resources close that gap, and how would you use them?",
        ],
      },
      {
        beat: GOALS_ANGLE_A.beats[4]!.beat,
        words: 50,
        your_lines: [],
        questions: ["What would shared records change for one patient you can picture?"],
      },
    ],
  },
};

export const KIT_CRITIC_REPLY: TaskOutput<"kit.critic"> = {
  findings: [
    {
      rule_id: "CRAFT-01",
      severity: "should",
      location: { paragraph_id: "p1", sentence: 0 },
      explanation: "The essay opens on a summary of the meeting rather than inside a moment.",
      fix_hint:
        "Start on the director proposing the rewrite, with one thing you saw or heard in the room.",
      patch: null,
    },
    {
      rule_id: "CRAFT-17",
      severity: "should",
      location: { paragraph_id: "p4", sentence: 2 },
      explanation: "The reflection says what asking would have done but not what you found out.",
      fix_hint: "Answer the open question in this paragraph; your answer is the reflection.",
      patch: null,
    },
    {
      rule_id: "CRAFT-07",
      severity: "consider",
      location: { paragraph_id: "p2", sentence: 3 },
      explanation: '"Then" adds nothing to this sentence.',
      fix_hint: 'Cut "Then".',
      patch: {
        op: "replace",
        paragraph_id: "p2",
        sentences: [
          ...SHAPED_DRAFT.paragraphs[1]!.sentences.slice(0, 3),
          S("I asked for fifteen minutes at the next planning meeting.", "adapted", ["S02"]),
        ],
      },
    },
  ],
  scores: { answers_prompt: 4, story_quality: 3, voice_fidelity: 4 },
  first_action: { paragraph_id: "p2", sentence: 0 },
};

const P4_REVISED = [
  ...SHAPED_DRAFT.paragraphs[3]!.sentences.slice(0, 3),
  S(
    "The numbers got the rewrite shelved; the question I skipped is the one I ask first now.",
    "composed",
    ["S02"],
  ),
];

/** First reply also rewrites p3, which the applicant edited by hand; the repair leaves it alone. */
export const DRAFT_REVISE_REPLIES: TaskOutput<"draft.revise">[] = [
  {
    patches: [
      {
        op: "replace",
        paragraph_id: "p3",
        sentences: SHAPED_DRAFT.paragraphs[2]!.sentences.slice(0, 3),
      },
      { op: "replace", paragraph_id: "p4", sentences: P4_REVISED },
    ],
    summary: "Ended on the question you ask first now, and tightened the meeting paragraph.",
  },
  {
    patches: [{ op: "replace", paragraph_id: "p4", sentences: P4_REVISED }],
    summary: "Ended on the question you ask first now instead of the page you shipped.",
  },
];

export const DRAFT_NEED_FILL_REPLY: TaskOutput<"draft.need_fill"> = {
  paragraph: {
    id: "p4",
    sentences: [
      S("What I learned came later, and it was less flattering.", "composed", ["S02"]),
      S(
        "I had built my whole case before I asked why the director wanted the rewrite.",
        "adapted",
        ["S02"],
      ),
      S("The director had been burned by this module before.", "adapted", ["F09"]),
      S(
        "The numbers won the meeting, but asking first would have made the director part of the answer.",
        "composed",
        ["S02"],
      ),
      S("Now I ask why before I build the counter-argument.", "composed", ["S02", "F09"]),
    ],
  },
  summary: "Added what you found out when you asked, and ended on what you do now.",
};

export const UTIL_CLASSIFY_REPLY: TaskOutput<"util.classify"> = {
  paragraph_ids: ["p4"],
  whole_draft: false,
  reason: "The ending is the last paragraph.",
};

const WORD_ANSWER = (why: string) => ({
  deliverable_key: "word",
  format: "prose" as const,
  paragraphs: [
    {
      id: "p1",
      sentences: [S("Handover.", "composed", ["S03", "S01"]), S(why, "adapted", ["S03", "L003"])],
    },
  ],
  list_tones: [],
  video: null,
  needs: [],
  why: "The Saturday class and the runbook both run without him; one word carries that.",
});

const SHORTFORM_REST = {
  book: {
    deliverable_key: "book",
    format: "prose" as const,
    paragraphs: [],
    list_tones: [],
    video: null,
    needs: [
      {
        paragraph_id: "p1",
        after_sentence: 0,
        question:
          "What is the last book you read that changed your mind, and what did it change? About 25 words.",
        approx_words: 25,
      },
    ],
    why: "No book is in your file yet, and this answer has to be one you actually read.",
  },
  video: {
    deliverable_key: "video",
    format: "talking_points" as const,
    paragraphs: [],
    list_tones: [],
    video: {
      questions: [
        {
          question: "Tell me about a team that did not work well.",
          points: [
            {
              text: "A six-month rewrite proposed against a five-month deadline",
              sources: ["S02", "K27"],
            },
            { text: "Numbers instead of principle; a trade, not a win", sources: ["S02", "L002"] },
            { text: "What I'd do now: ask why before building the case", sources: ["S02"] },
          ],
        },
        {
          question: "Tell me about something you got wrong in a team.",
          points: [
            { text: "The migration tested on a three-month-old copy", sources: ["S04"] },
            { text: "Restored within two hours; wrote the incident note myself", sources: ["S04"] },
            { text: "The schema check that has blocked four migrations since", sources: ["S04"] },
          ],
        },
      ],
      structure: {
        seconds: 90,
        segments: [
          { label: "The situation in one line", seconds: 15 },
          { label: "What you did", seconds: 45 },
          { label: "What changed, and what you do now", seconds: 30 },
        ],
      },
    },
    needs: [],
    why: "A live conversation: talking points to practise from, never a script to read.",
  },
};

/** First reply runs the one-word answer over its 150 characters; the repair trims it. */
export const KIT_SHORTFORM_REPLIES: TaskOutput<"kit.shortform">[] = [
  {
    goals_statement: null,
    items: [
      WORD_ANSWER(
        "I build things to run without me: the Saturday coding class I started with four students has run without me for six months, and the runbook I wrote at the hospital became the template.",
      ),
      SHORTFORM_REST.book,
      SHORTFORM_REST.video,
    ],
    verify: [],
  },
  {
    goals_statement: null,
    items: [
      WORD_ANSWER(
        "I build things to run without me: my Saturday class has not needed me for six months.",
      ),
      SHORTFORM_REST.book,
      SHORTFORM_REST.video,
    ],
    verify: [],
  },
];
