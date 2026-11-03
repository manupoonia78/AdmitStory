// The evidence slot model (spec Appendix C). This is the spine of Story Studio: the conversation is
// driven by which of these 48 slots are still empty, not by the model's whims (§5.2). The model
// only phrases the question the selector has already chosen.
//
// Appendix C is content, not a suggestion (§0): weights, chapters and archetypes below are the
// table, transcribed. The `consumers` field holds the table's parenthetical entries — "(forms,
// resume)", "(recommender kit)" — which are not prompt archetypes but still need the slot.

import type { ArchetypeId, ChapterId } from "@admitstory/shared";
import { z } from "zod";

/** Things other than an essay prompt that consume a slot (Appendix C's parentheticals). */
export const SLOT_CONSUMERS = [
  "forms",
  "resume",
  "recommenders",
  "interview",
  "all_deliverables",
] as const;

export type SlotConsumer = (typeof SLOT_CONSUMERS)[number];

export interface Slot {
  key: string;
  /** 1–5: importance across typical applications (Appendix C). */
  weight: number;
  /** The chapter this slot belongs to; the selector prefers the chapter the applicant is in. */
  chapter: ChapterId;
  /** Prompt archetypes that need this slot. */
  archetypes: readonly ArchetypeId[];
  consumers?: readonly SlotConsumer[];
  /**
   * Factual slots are filled by confirmed facts; the rest need a story (Appendix C's closing
   * note: "A slot is filled when it is linked to at least one confirmed story — or confirmed
   * facts for factual slots").
   */
  factual?: true;
  /**
   * Substrings of the Fact Sheet keys that evidence a factual slot. A heuristic rather than a
   * fixed list, because the Extractor names its own keys (`team_size`, `spend_responsibility`),
   * and a slot being marked filled only ever means the Interviewer stops asking — it never puts
   * anything into a draft.
   */
  factKeys?: readonly string[];
  /** Appendix C marks `reapp.changes` as reapplicants only; the selector drops it otherwise. */
  reapplicantOnly?: true;
}

export const SLOTS: readonly Slot[] = [
  // Roots
  { key: "identity.root", weight: 5, chapter: "roots", archetypes: ["IDENTITY", "LIST"] },
  {
    key: "identity.family_influence",
    weight: 3,
    chapter: "roots",
    archetypes: ["IDENTITY", "VALUES"],
  },
  {
    key: "identity.early_responsibility",
    weight: 3,
    chapter: "roots",
    archetypes: ["IDENTITY", "CONTEXT"],
  },
  { key: "identity.defining_moment", weight: 3, chapter: "roots", archetypes: ["IDENTITY"] },
  {
    key: "perspective.cross_cultural",
    weight: 3,
    chapter: "roots",
    archetypes: ["IDENTITY", "CONTRIBUTION"],
  },
  // Education
  { key: "academics.choice", weight: 2, chapter: "education", archetypes: ["GOALS"] },
  {
    key: "academics.intellectual_moment",
    weight: 2,
    chapter: "education",
    archetypes: ["IDENTITY"],
  },
  { key: "academics.quant_evidence", weight: 4, chapter: "education", archetypes: ["OPTIONAL"] },
  { key: "academics.anomaly", weight: 3, chapter: "education", archetypes: ["OPTIONAL"] },
  { key: "leadership.college", weight: 2, chapter: "education", archetypes: ["LEADERSHIP"] },
  // Work
  { key: "work.motivation", weight: 3, chapter: "work", archetypes: ["GOALS"] },
  {
    key: "work.scope",
    weight: 4,
    chapter: "work",
    archetypes: [],
    consumers: ["forms", "resume"],
    factual: true,
    factKeys: ["team_size", "scope", "reports", "responsibility", "_scale", "headcount"],
  },
  { key: "work.arc", weight: 4, chapter: "work", archetypes: ["GOALS"] },
  { key: "impact.biggest", weight: 5, chapter: "work", archetypes: ["LEADERSHIP", "GOALS"] },
  {
    key: "numbers.impact",
    weight: 5,
    chapter: "work",
    archetypes: [],
    consumers: ["forms", "resume", "all_deliverables"],
  },
  { key: "leadership.originated_idea", weight: 5, chapter: "work", archetypes: ["LEADERSHIP"] },
  { key: "leadership.persuaded_up", weight: 5, chapter: "work", archetypes: ["LEADERSHIP"] },
  {
    key: "leadership.initiative_risky",
    weight: 4,
    chapter: "work",
    archetypes: ["LEADERSHIP", "VALUES"],
  },
  {
    key: "leadership.developed_others",
    weight: 4,
    chapter: "work",
    archetypes: ["LEADERSHIP", "SUPPORT"],
  },
  {
    key: "employ.trajectory",
    weight: 4,
    chapter: "work",
    archetypes: [],
    consumers: ["forms", "recommenders"],
    factual: true,
    factKeys: ["promotion", "title_previous", "title_earlier", "title_first", "commendation"],
  },
  { key: "employ.cross_functional", weight: 4, chapter: "work", archetypes: ["LEADERSHIP"] },
  {
    key: "self.feedback",
    weight: 5,
    chapter: "work",
    archetypes: ["SETBACK"],
    consumers: ["recommenders"],
  },
  // Beyond work
  {
    key: "identity.practice",
    weight: 3,
    chapter: "beyond_work",
    archetypes: ["IDENTITY", "LIST", "MICRO"],
  },
  { key: "community.interests", weight: 3, chapter: "beyond_work", archetypes: ["MICRO", "LIST"] },
  {
    key: "community.built",
    weight: 4,
    chapter: "beyond_work",
    archetypes: ["CONTRIBUTION", "LEADERSHIP"],
  },
  {
    key: "support.ongoing",
    weight: 2,
    chapter: "beyond_work",
    archetypes: ["SUPPORT", "CONTRIBUTION"],
  },
  // Turning points
  {
    key: "identity.turning_point",
    weight: 4,
    chapter: "turning_points",
    archetypes: ["IDENTITY", "GOALS"],
  },
  {
    key: "perspective.difference",
    weight: 3,
    chapter: "turning_points",
    archetypes: ["SUPPORT", "CONTRIBUTION"],
  },
  {
    key: "leadership.changed_course",
    weight: 3,
    chapter: "turning_points",
    archetypes: ["LEADERSHIP"],
  },
  { key: "failure.consequential", weight: 5, chapter: "turning_points", archetypes: ["SETBACK"] },
  { key: "support.someone_hard", weight: 4, chapter: "turning_points", archetypes: ["SUPPORT"] },
  { key: "values.dilemma", weight: 3, chapter: "turning_points", archetypes: ["VALUES"] },
  // People and values
  {
    key: "identity.quirks",
    weight: 2,
    chapter: "people_and_values",
    archetypes: ["LIST", "MICRO"],
  },
  { key: "self.others_view", weight: 2, chapter: "people_and_values", archetypes: ["IDENTITY"] },
  { key: "values.line", weight: 2, chapter: "people_and_values", archetypes: ["VALUES"] },
  { key: "values.role_model", weight: 3, chapter: "people_and_values", archetypes: ["IDENTITY"] },
  // Goals
  { key: "goals.short_term", weight: 5, chapter: "goals", archetypes: ["GOALS", "GOALBOX"] },
  { key: "goals.long_term", weight: 5, chapter: "goals", archetypes: ["GOALS", "GOALBOX"] },
  { key: "goals.origin", weight: 5, chapter: "goals", archetypes: ["GOALS"] },
  { key: "goals.research", weight: 4, chapter: "goals", archetypes: ["GOALS", "WHY-SCHOOL"] },
  {
    key: "goals.plan_b",
    weight: 3,
    chapter: "goals",
    archetypes: ["GOALS"],
    consumers: ["interview"],
  },
  { key: "why.gap", weight: 5, chapter: "goals", archetypes: ["GOALS"] },
  { key: "why.now", weight: 4, chapter: "goals", archetypes: ["GOALS"] },
  // Schools
  { key: "fit.reasons", weight: 4, chapter: "schools", archetypes: ["WHY-SCHOOL"] },
  {
    key: "fit.conversations",
    weight: 4,
    chapter: "schools",
    archetypes: ["WHY-SCHOOL", "REAPPLICANT"],
  },
  {
    key: "fit.contribution",
    weight: 4,
    chapter: "schools",
    archetypes: ["CONTRIBUTION", "WHY-SCHOOL"],
  },
  {
    key: "reapp.changes",
    weight: 5,
    chapter: "schools",
    archetypes: ["REAPPLICANT"],
    reapplicantOnly: true,
  },
  // Recommenders
  {
    key: "lor.candidates",
    weight: 4,
    chapter: "recommenders",
    archetypes: [],
    consumers: ["recommenders"],
    factual: true,
    factKeys: ["recommender", "referee"],
  },
] as const;

export type SlotKey = (typeof SLOTS)[number]["key"];

export const SLOT_KEYS = SLOTS.map((slot) => slot.key) as readonly SlotKey[];

export const SlotKey = z.enum(SLOT_KEYS as [SlotKey, ...SlotKey[]]);

const BY_KEY = new Map(SLOTS.map((entry) => [entry.key, entry] as const));

export function slot(key: SlotKey): Slot {
  const found = BY_KEY.get(key);
  if (!found) throw new Error(`Unknown slot: ${key}`);
  return found;
}

export function isSlotKey(value: string): value is SlotKey {
  return BY_KEY.has(value as SlotKey);
}

export function slotsInChapter(chapter: ChapterId): Slot[] {
  return SLOTS.filter((entry) => entry.chapter === chapter);
}
