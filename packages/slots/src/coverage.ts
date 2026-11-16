// The Studio coverage meter (spec §5.2): the four admissions lenses plus Goals and School fit,
// each as a short bar with a level in words. It is a progress indicator, not a percent-complete
// bar, so it reads from what the slots actually hold rather than counting answers.
//
// Lens coverage comes from the stories linked to a slot, because a lens is evidenced by stories
// (Appendix D maps traits to lenses). Goals and School fit come from their own chapters' slots,
// since "goals" is not a lens — it is a part of the application that has to be there.

import { COVERAGE_IDS, type CoverageId, type CoverageLevel, type LensId } from "@admitstory/shared";
import { SLOTS, type SlotKey } from "./slots";
import { emptyRecord, type SlotRecord } from "./state";

/** A story as coverage needs it: which lenses it evidences, and whether it is confirmed. */
export interface CoverageStory {
  id: string;
  lenses: readonly LensId[];
  confirmed: boolean;
}

/** Levels by how many confirmed stories evidence a lens. Thin means "we have a start". */
function levelFromStories(confirmed: number, partial: number): CoverageLevel {
  if (confirmed >= 3) return "strong";
  if (confirmed >= 2) return "partial";
  if (confirmed === 1) return partial > 0 ? "partial" : "thin";
  return partial > 0 ? "thin" : "none";
}

/** Levels by the share of a chapter's slots that are filled. */
function levelFromSlots(filled: number, partial: number, total: number): CoverageLevel {
  if (total === 0) return "none";
  const share = (filled + partial * 0.5) / total;
  if (share >= 0.75) return "strong";
  if (share >= 0.4) return "partial";
  if (share > 0) return "thin";
  return "none";
}

export interface CoverageBar {
  id: CoverageId;
  level: CoverageLevel;
  /** What is missing, in a few words, or what proves it. Shown under the bar. */
  note?: string;
}

/** A Fact Sheet entry as coverage needs it. */
export interface CoverageFact {
  key: string;
  confirmed: boolean;
}

export interface CoverageInput {
  stories: readonly CoverageStory[];
  states: ReadonlyMap<SlotKey, SlotRecord>;
  /**
   * The Fact Sheet. A lens is evidenced by stories, but an applicant who has told us their degree,
   * scores, employer and team size has given the reader something on that lens, and the meter must
   * show it: before this, answers that were all facts left every bar at "not yet".
   */
  facts?: readonly CoverageFact[];
}

/**
 * Which lens a fact speaks to, by its snake_case key (the Extractor's keys are free-form, so this
 * matches on parts). A fact can count for more than one lens; most count for none.
 */
const FACT_LENS_PATTERNS: Record<LensId, RegExp> = {
  academics:
    /gmat|\bgre\b|_gre|gre_|gpa|cgpa|grade|degree|university|college|undergrad|major|minor|high_school|_school$|education|test_|toefl|ielts|class_rank|rank_|scholarship|coursework|course_|thesis|cfa|cpa|certif|exam/,
  employability:
    /employer|company|firm|title|role|designation|job|industry|experience|years_|tenure|promotion|skill|tool|language|client|revenue|budget|salary|certif|function|sector|career/,
  leadership:
    /team_size|reports|headcount|led_|lead_|leader|manag|captain|president|founder|co_founder|mentor|volunteer_role|chair|head_/,
  self_awareness: /weakness|strength|learning|lesson|value|motivation|feedback/,
};

export function lensesForFactKey(key: string): LensId[] {
  const normalized = key.toLowerCase();
  return (Object.keys(FACT_LENS_PATTERNS) as LensId[]).filter((lens) =>
    FACT_LENS_PATTERNS[lens].test(normalized),
  );
}

/** Facts alone never make a lens more than partial: a reader still wants a story behind them. */
function levelFromFacts(confirmed: number, stated: number): CoverageLevel {
  if (confirmed >= 3) return "partial";
  if (confirmed + stated > 0) return "thin";
  return "none";
}

const LEVEL_RANK: Record<CoverageLevel, number> = { none: 0, thin: 1, partial: 2, strong: 3 };
const higher = (a: CoverageLevel, b: CoverageLevel) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a);

const GOAL_SLOTS = SLOTS.filter((slot) => slot.chapter === "goals").map((slot) => slot.key);
const SCHOOL_SLOTS = SLOTS.filter((slot) => slot.chapter === "schools").map((slot) => slot.key);

function chapterLevel(keys: readonly SlotKey[], states: CoverageInput["states"]): CoverageLevel {
  let filled = 0;
  let partial = 0;
  for (const key of keys) {
    const record = states.get(key) ?? emptyRecord(key);
    if (record.state === "filled") filled += 1;
    else if (record.state === "partial") partial += 1;
  }
  return levelFromSlots(filled, partial, keys.length);
}

export function coverage(input: CoverageInput): CoverageBar[] {
  return COVERAGE_IDS.map((id): CoverageBar => {
    if (id === "goals") return { id, level: chapterLevel(GOAL_SLOTS, input.states) };
    if (id === "school_fit") return { id, level: chapterLevel(SCHOOL_SLOTS, input.states) };
    const lens = id as LensId;
    const matching = input.stories.filter((story) => story.lenses.includes(lens));
    const fromStories = levelFromStories(
      matching.filter((story) => story.confirmed).length,
      matching.filter((story) => !story.confirmed).length,
    );
    const facts = (input.facts ?? []).filter((fact) => lensesForFactKey(fact.key).includes(lens));
    const fromFacts = levelFromFacts(
      facts.filter((fact) => fact.confirmed).length,
      facts.filter((fact) => !fact.confirmed).length,
    );
    const level = higher(fromStories, fromFacts);
    // Say where a level came from when facts carried it, so "thin" doesn't read as "ignored".
    const note =
      matching.length === 0 && facts.length > 0
        ? `${facts.length} ${facts.length === 1 ? "fact" : "facts"} so far — a story will strengthen it`
        : undefined;
    return note ? { id, level, note } : { id, level };
  });
}
