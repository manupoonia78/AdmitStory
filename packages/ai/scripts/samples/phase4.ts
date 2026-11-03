/**
 * Fixed inputs for the Phase 4 writing tasks, shared by the synthetic recorder (record-phase4.ts),
 * the request check (check-tasks.ts) and the tests. Everything is fictional (spec §0):
 *
 * - The applicant is the `engineer-to-product` fixture, compiled into the same compact dossier as
 *   the Phase 3 samples (phase3.ts). His sensitive story S05 is withheld.
 * - Long essays are for the fictional Halvorsen pack (frozen in halvorsen.compiled.txt) and use
 *   the Strategist's recorded file map. Short items are for the fictional Kestrel Lake pack, which
 *   has two 150-character micro answers and a live video conversation; its compiled text is frozen
 *   in kestrel-lake.compiled.txt (packages/kb `compilePack`, cycle 2026-27).
 *
 * Changing any value here changes a request hash: re-run `pnpm --filter @admitstory/ai
 * record:phase4 --synthetic` afterwards.
 */
import { readFileSync } from "node:fs";
import type { Angle, Draft, FileMap } from "@admitstory/shared/kit";
import type { RunContext, TaskInput, WritingDeliverable } from "../../src";
import { findRepoRoot } from "../../src/paths";
import { ENGINEER_DOSSIER, HALVORSEN_PACK, HALVORSEN_RETRIEVAL } from "./phase3";
import { KIT_POSITIONING_REPLIES } from "./phase3-replies";

const root = findRepoRoot(process.cwd());
if (!root) throw new Error("Run from inside the AdmitStory repo");

/** L1 for the short items: the Kestrel Lake pack as compiled for cycle 2026-27. */
export const KESTREL_PACK = readFileSync(
  `${root}/packages/ai/scripts/samples/kestrel-lake.compiled.txt`,
  "utf8",
).trimEnd();

/** The Strategist's (repaired) Halvorsen file map, as recorded in Phase 3. */
export const HALVORSEN_FILE_MAP: FileMap = KIT_POSITIONING_REPLIES.at(-1)!.file_map;

/* Halvorsen deliverables -------------------------------------------------------------------- */

export const GOALS_ESSAY: WritingDeliverable = {
  key: "goals",
  kind: "essay",
  prompt:
    "What do you want to be doing five years after you graduate, and how will the Halvorsen MBA help you get there?",
  parts: ["post-MBA role five years out", "how the Halvorsen MBA closes the gap"],
  limit: { kind: "words", value: 500 },
  archetypes: ["GOALS", "WHY-SCHOOL"],
  pack_code: "K06",
};

export const SHAPED_ESSAY: WritingDeliverable = {
  key: "shaped",
  kind: "essay",
  prompt:
    "Tell us about a time you changed how a group worked. What did you do, and what did you learn about yourself?",
  parts: ["the change you made in a group", "what you learned about yourself"],
  limit: { kind: "words", value: 400 },
  archetypes: ["LEADERSHIP"],
  pack_code: "K09",
};

const OPTIONAL_ESSAY: WritingDeliverable = {
  key: "optional",
  kind: "optional_essay",
  prompt: "Is there anything else you would like the admissions committee to know?",
  limit: { kind: "words", value: 250 },
  archetypes: ["OPTIONAL"],
  pack_code: "K13",
};

const ACTIVITIES: WritingDeliverable = {
  key: "activities",
  kind: "form_section",
  prompt: "Community involvement: up to 5 entries, role and time per month.",
  limit: { kind: "chars_incl_spaces", value: 250 },
  pack_code: "K15",
};

const INTERVIEW_RESUME: WritingDeliverable = {
  key: "interview_resume",
  kind: "interview_question",
  prompt: "Walk me through your resume.",
  limit: null,
  pack_code: "K44",
};

export const KIT_GAPS_INPUT: TaskInput<"kit.gaps"> = {
  deliverables: [GOALS_ESSAY, SHAPED_ESSAY, OPTIONAL_ESSAY, ACTIVITIES, INTERVIEW_RESUME],
  file_map: HALVORSEN_FILE_MAP,
};

export const KIT_ANGLES_INPUT: TaskInput<"kit.angles"> = {
  essays: [GOALS_ESSAY, SHAPED_ESSAY],
  file_map: HALVORSEN_FILE_MAP,
  lead_traits: ["brings_people_along", "commercial_judgment"],
};

/* Angles the drafts are written from (kit.angles' recommended picks) ------------------------ */

export const GOALS_ANGLE_A: Angle = {
  deliverable_key: "goals",
  label: "A",
  pitch:
    "Start on the ward where a screen worked as specified and was still wrong, and build the goal from what he did next.",
  opening_line: "It was working exactly as specified, and it was still wrong.",
  stories: ["S06", "S01"],
  beats: [
    {
      beat: "The ward: a screen that worked as specified and was still wrong",
      words: 110,
      sources: ["S06", "L004"],
    },
    {
      beat: "Taking the nurses' list to the product team instead of patching the code",
      words: 90,
      sources: ["S06"],
    },
    {
      beat: "The role five years out: product manager on a health-data team, owning a clinical workflow",
      words: 110,
      sources: ["S06"],
    },
    {
      beat: "What Halvorsen closes: deciding what to build, with at most two named resources",
      words: 120,
      sources: ["K08", "K30", "K38"],
    },
    { beat: "Landing: shared health records across Indian hospitals", words: 50, sources: [] },
  ],
  proves: ["commercial_judgment", "curious_learner"],
  risks: ["The night-shift fix also carries the interview walk-through; keep it to one line here."],
  recommended: true,
  reason:
    "It gives readers the specific first role and the bridge from current work they look for (K07), and leaves the rewrite story to the leadership essay.",
};

export const SHAPED_ANGLE_A: Angle = {
  deliverable_key: "shaped",
  label: "A",
  pitch:
    "The planning meeting where fifteen minutes of numbers shelved a six-month rewrite, and the question he asked too late.",
  opening_line: "I showed them the numbers instead of arguing the principle.",
  stories: ["S02"],
  beats: [
    {
      beat: "The proposal: a six-month rewrite against a five-month deadline",
      words: 70,
      sources: ["S02"],
    },
    { beat: "The weekend of instrumenting and the four-day fix", words: 90, sources: ["S02"] },
    {
      beat: "Fifteen minutes at planning: numbers, not principle",
      words: 90,
      sources: ["S02", "L002"],
    },
    { beat: "What he learned: he built his case before asking why", words: 110, sources: ["S02"] },
  ],
  proves: ["brings_people_along", "analytical"],
  risks: ["Reads as winning an argument unless the reflection carries real weight."],
  recommended: true,
  reason:
    "Halvorsen wants practical collaborators who leave teams better than they found them (K25); this shows a group's decision changed by evidence and a compromise.",
};

const OTHER_DELIVERABLES = [
  {
    key: "goals",
    primary_story: "S06",
    first_line: "It was working exactly as specified, and it was still wrong.",
    last_line: null,
  },
  { key: "interview_resume", primary_story: "S01", first_line: null, last_line: null },
];

export const KIT_DRAFT_INPUT: TaskInput<"kit.draft"> = {
  mode: "draft",
  deliverable: SHAPED_ESSAY,
  angle: SHAPED_ANGLE_A,
  file_map_item: HALVORSEN_FILE_MAP.items.find((item) => item.deliverable_key === "shaped")!,
  other_deliverables: OTHER_DELIVERABLES,
  retrieval: [],
};

/** Coach mode: the applicant chose a stricter mode than Halvorsen's policy requires (§14.2). */
export const KIT_DRAFT_COACH_INPUT: TaskInput<"kit.draft"> = {
  mode: "coach",
  deliverable: GOALS_ESSAY,
  angle: GOALS_ANGLE_A,
  file_map_item: HALVORSEN_FILE_MAP.items.find((item) => item.deliverable_key === "goals")!,
  other_deliverables: [
    { key: "shaped", primary_story: "S02", first_line: null, last_line: null },
    { key: "interview_resume", primary_story: "S01", first_line: null, last_line: null },
  ],
  retrieval: HALVORSEN_RETRIEVAL,
};

/* The shaped essay as the Writer returns it; the Critic, Reviser and NEED fill work on it. ---- */

const S = (text: string, kind: "verbatim" | "adapted" | "composed", sources: string[]) => ({
  text,
  kind,
  sources,
});

export const SHAPED_DRAFT: Draft = {
  paragraphs: [
    {
      id: "p1",
      sentences: [
        S(
          "At planning, a director proposed rebuilding the scheduling module for our US customer, a six-month job for the whole backend team.",
          "adapted",
          ["S02"],
        ),
        S("The customer needed to go live in five.", "adapted", ["S02"]),
        S(
          "I thought the slow pages had a smaller cause, but a hunch was not going to move a director.",
          "composed",
          ["S02"],
        ),
      ],
    },
    {
      id: "p2",
      sentences: [
        S("So I spent a weekend instrumenting the module.", "adapted", ["S02"]),
        S("Eighty percent of the slow requests came from three queries.", "adapted", ["S02"]),
        S("In four days I had a working fix for two of them.", "adapted", ["S02"]),
        S("Then I asked for fifteen minutes at the next planning meeting.", "adapted", ["S02"]),
      ],
    },
    {
      id: "p3",
      sentences: [
        S("I showed them the numbers instead of arguing the principle.", "verbatim", ["L002"]),
        S("Page loads fell from 4.2 seconds to 900 milliseconds.", "adapted", ["S02"]),
        S(
          "I offered a trade: fix the queries now, and revisit the architecture after go-live.",
          "adapted",
          ["S02"],
        ),
        S("The rewrite was shelved, and the customer went live a month early.", "adapted", ["S02"]),
      ],
    },
    {
      id: "p4",
      sentences: [
        S("What I learned came later, and it was less flattering.", "composed", ["S02"]),
        S(
          "I had built my whole case before I asked why the director wanted the rewrite.",
          "adapted",
          ["S02"],
        ),
        S(
          "The numbers won the meeting, but asking first would have made the director part of the answer.",
          "composed",
          ["S02"],
        ),
        S("The fastest page I ever shipped started with a question I asked too late.", "composed", [
          "S02",
        ]),
      ],
    },
  ],
  needs: [
    {
      paragraph_id: "p4",
      after_sentence: 1,
      question:
        "What did you find out when you finally asked why the director wanted the rewrite? About 30 words.",
      approx_words: 30,
    },
  ],
  prompt_parts_answered: [
    { part: "the change you made in a group", paragraph_ids: ["p2", "p3"] },
    { part: "what you learned about yourself", paragraph_ids: ["p4"] },
  ],
  notes: {
    why_this_story:
      "The rewrite story is the clearest time he changed a group's decision, and the file map gives it to this essay alone.",
    what_it_proves:
      "That he moves people with evidence and a compromise, and that he can say plainly what he did late.",
    school_fit_points: [
      {
        text: "Halvorsen's practical collaborator: a group's decision changed by evidence and a trade, not by rank.",
        k_ids: ["K25"],
      },
    ],
  },
  verify: [
    {
      text: "Page loads fell from 4.2 seconds to 900 milliseconds.",
      reason: "A number readers may check against your resume; confirm it matches your records.",
    },
    {
      text: "The numbers won the meeting, but asking first would have made the director part of the answer.",
      reason: "A reflection written from your story; confirm it is what you think.",
    },
  ],
};

export const KIT_CRITIC_INPUT: TaskInput<"kit.critic"> = {
  deliverable: SHAPED_ESSAY,
  draft: SHAPED_DRAFT,
  file_map_item: KIT_DRAFT_INPUT.file_map_item,
  other_deliverables: OTHER_DELIVERABLES,
  linter_findings: [
    {
      rule_id: "limit",
      severity: "consider",
      location: { paragraph_id: null, sentence: null },
      explanation: "The draft uses less than 85% of the 400-word limit.",
      fix_hint: "Use the room for the reflection.",
    },
  ],
};

/** The S02 block of the dossier: the only dossier item a revision of this essay needs (§8.6). */
export const S02_ITEMS = (() => {
  const rows = ENGINEER_DOSSIER.split("\n");
  const start = rows.findIndex((row) => row.startsWith('S02 "'));
  const end = rows.findIndex((row, i) => i > start && /^\S/.test(row));
  return rows.slice(start, end).join("\n");
})();

export const DRAFT_REVISE_INPUT: TaskInput<"draft.revise"> = {
  instruction: "Stronger ending",
  target_paragraph_ids: ["p4"],
  draft: { paragraphs: SHAPED_DRAFT.paragraphs },
  locked_paragraph_ids: ["p1"],
  user_edited_paragraph_ids: ["p3"],
  dossier_items: S02_ITEMS,
  limit: { kind: "words", value: 400 },
};

/** The applicant's answer to the shaped essay's NEED, saved to the dossier as F09. */
export const NEED_ANSWER =
  "She had been burned by this module before. I found that out only after I had built my whole case against her.";

export const DRAFT_NEED_FILL_INPUT: TaskInput<"draft.need_fill"> = {
  paragraph: SHAPED_DRAFT.paragraphs[3]!,
  before: SHAPED_DRAFT.paragraphs[2]!.sentences.map((s) => s.text).join(" "),
  after: null,
  need: { question: SHAPED_DRAFT.needs[0]!.question, approx_words: 30 },
  answer: { text: NEED_ANSWER, code: "F09" },
  limit_words: 110,
};

export const UTIL_CLASSIFY_INPUT: TaskInput<"util.classify"> = {
  instruction: "Make the ending land harder",
  paragraphs: SHAPED_DRAFT.paragraphs.map((p) => ({
    id: p.id,
    text: p.sentences.map((s) => s.text).join(" "),
    locked: p.id === "p1",
  })),
};

/* Kestrel Lake short items ------------------------------------------------------------------ */

/** A file map for Kestrel Lake, as the Strategist would return it (hand-authored, fictional). */
export const KESTREL_FILE_MAP: FileMap = {
  items: [
    {
      deliverable_key: "impact",
      primary_story: "S02",
      primary_reason_if_none: null,
      supporting: [],
      traits_shown: ["brings_people_along", "analytical"],
      lenses: ["leadership", "employability"],
      why: "Kestrel Lake asks how impact was measured, and the rewrite story is measured to the millisecond.",
    },
    {
      deliverable_key: "goals",
      primary_story: "S06",
      primary_reason_if_none: null,
      supporting: [],
      traits_shown: ["commercial_judgment", "curious_learner"],
      lenses: ["employability"],
      why: "The ward story is where the product goal started.",
    },
    {
      deliverable_key: "word",
      primary_story: "S03",
      primary_reason_if_none: null,
      supporting: ["S01"],
      traits_shown: ["community_builder", "develops_people"],
      lenses: ["self_awareness"],
      why: "He builds things to run without him, which is one word's worth of identity.",
    },
    {
      deliverable_key: "book",
      primary_story: null,
      primary_reason_if_none: "No book is in the dossier yet; ask the applicant.",
      supporting: [],
      traits_shown: [],
      lenses: [],
      why: "The answer has to be a real book he read.",
    },
    {
      deliverable_key: "video",
      primary_story: "S04",
      primary_reason_if_none: null,
      supporting: ["S02"],
      traits_shown: ["honest_about_limits", "acts_on_feedback"],
      lenses: ["self_awareness"],
      why: "A conversation about team experiences invites the migration he got wrong.",
    },
  ],
  recommender_plan: [],
  coverage_gaps: [],
  warnings: [],
};

export const KIT_SHORTFORM_INPUT: TaskInput<"kit.shortform"> = {
  items: [
    {
      key: "word",
      kind: "short_answer",
      prompt: "Which one word best describes you, and why?",
      parts: ["one word", "why"],
      limit: { kind: "chars_excl_spaces", value: 150 },
      archetypes: ["MICRO", "IDENTITY"],
      pack_code: "K07",
    },
    {
      key: "book",
      kind: "short_answer",
      prompt: "What is the last book you read that changed your mind about something?",
      parts: ["the book", "what changed"],
      limit: { kind: "chars_excl_spaces", value: 150 },
      archetypes: ["MICRO"],
      pack_code: "K08",
    },
    {
      key: "video",
      kind: "video",
      prompt: "A live, unscripted conversation with a second-year student about team experiences.",
      limit: null,
      archetypes: ["VIDEO"],
      pack_code: "K09",
    },
  ],
  file_map: KESTREL_FILE_MAP,
  essay_lines: ["I showed them the numbers instead of arguing the principle."],
  retrieval: [],
};

/* The layers each sample runs with. */
export const HALVORSEN_CTX: RunContext = { schoolPack: HALVORSEN_PACK, dossier: ENGINEER_DOSSIER };
export const KESTREL_CTX: RunContext = { schoolPack: KESTREL_PACK, dossier: ENGINEER_DOSSIER };
