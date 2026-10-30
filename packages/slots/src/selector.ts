// The slot selector (spec §5.2). Deterministic TypeScript — cheap and inspectable — so the model
// never decides what to ask about, only how to phrase it:
//
//   next_slot = argmax over slots of
//       weight(slot)
//     × need(slot | the schools the applicant is considering, or a default top-20 mix)
//     × emptiness(slot)          // 1.0 empty, 0.5 partial, 0 filled
//     × chapter_affinity(slot)   // prefer the current chapter
//     − fatigue(slot)            // asked recently / the applicant skipped it
//
// `need` is injectable because the real term needs School Packs, which arrive in Phase 3. Until
// then DEFAULT_NEED stands in: how often a typical top-20 application asks for the archetypes a
// slot feeds (packages/shared `ARCHETYPES.prevalence`). It only has to rank slots sensibly.

import { REAPPLICANT_ONLY_ARCHETYPES, archetype, type ChapterId } from "@admitstory/shared";
import { SLOTS, type Slot, type SlotKey } from "./slots";
import { emptiness, emptyRecord, type SlotRecord, type SlotState } from "./state";

export interface NeedContext {
  /** Set when the applicant has told us they applied before (§5.2, Appendix C). */
  isReapplicant?: boolean;
}

export type NeedFn = (slot: Slot, context: NeedContext) => number;

/**
 * How much a typical application needs this slot, without a School Pack: the strongest archetype
 * that consumes it, with a floor for slots that only feed forms, the resume, recommenders or the
 * interview — those are always needed, just never by an essay.
 */
export const DEFAULT_NEED: NeedFn = (entry, context) => {
  const relevant = entry.archetypes.filter(
    (id) => context.isReapplicant === true || !REAPPLICANT_ONLY_ARCHETYPES.includes(id),
  );
  const fromArchetypes = relevant.map((id) => archetype(id).prevalence);
  const fromConsumers = (entry.consumers?.length ?? 0) > 0 ? [0.9] : [];
  const candidates = [...fromArchetypes, ...fromConsumers];
  return candidates.length > 0 ? Math.max(...candidates) : 0;
};

export interface SelectorOptions {
  /** The chapter the applicant is in; slots elsewhere are still eligible, just less preferred. */
  chapter?: ChapterId | null;
  /** Current state per slot. Anything missing counts as empty. */
  states?: ReadonlyMap<SlotKey, SlotRecord>;
  context?: NeedContext;
  need?: NeedFn;
  /** "now", passed in rather than read, so a selection is reproducible. */
  now: Date;
  /**
   * Gap-only questioning (§5.2 hurry mode): restrict to these slots. Phase 3 fills it from the
   * chosen school's prompts; until then the Studio passes the highest-weight unfilled slots.
   */
  only?: readonly SlotKey[];
  /** Slots to leave alone this turn — usually the one just asked. */
  exclude?: readonly SlotKey[];
}

/** Spec §5.2: prefer the current chapter. Elsewhere still competes, at half the pull. */
const OTHER_CHAPTER_AFFINITY = 0.5;

/** Fatigue: asked within the hour, and every skip, make a slot less attractive. */
const RECENTLY_ASKED_MINUTES = 60;
const RECENT_ASK_PENALTY = 1.5;
const SKIP_PENALTY = 0.75;
/** Three skips means they do not want to talk about it; stop offering it. */
export const SKIPS_BEFORE_RETIRED = 3;

export function fatigue(record: SlotRecord, now: Date): number {
  let penalty = record.skippedCount * SKIP_PENALTY;
  if (record.lastAskedAt) {
    const minutes = (now.getTime() - record.lastAskedAt.getTime()) / 60_000;
    if (minutes < RECENTLY_ASKED_MINUTES)
      penalty += RECENT_ASK_PENALTY * (1 - minutes / RECENTLY_ASKED_MINUTES);
  }
  return penalty;
}

export interface SlotScore {
  slot: Slot;
  state: SlotState;
  score: number;
  /** The terms behind the score, for the admin console and for explaining a choice. */
  terms: { weight: number; need: number; emptiness: number; affinity: number; fatigue: number };
}

export function scoreSlots(options: SelectorOptions): SlotScore[] {
  const {
    chapter = null,
    states = new Map<SlotKey, SlotRecord>(),
    context = {},
    need = DEFAULT_NEED,
    now,
    only,
    exclude = [],
  } = options;

  const allowed = only ? new Set(only) : null;
  const skip = new Set(exclude);

  const scores: SlotScore[] = [];
  for (const entry of SLOTS) {
    if (allowed && !allowed.has(entry.key)) continue;
    if (skip.has(entry.key)) continue;
    // Appendix C: this slot exists only for reapplicants.
    if (entry.reapplicantOnly && context.isReapplicant !== true) continue;

    const record = states.get(entry.key) ?? emptyRecord(entry.key);
    if (record.skippedCount >= SKIPS_BEFORE_RETIRED) continue;

    const terms = {
      weight: entry.weight,
      need: need(entry, context),
      emptiness: emptiness(record.state),
      affinity: chapter === null || entry.chapter === chapter ? 1 : OTHER_CHAPTER_AFFINITY,
      fatigue: fatigue(record, now),
    };
    scores.push({
      slot: entry,
      state: record.state,
      score: terms.weight * terms.need * terms.emptiness * terms.affinity - terms.fatigue,
      terms,
    });
  }

  // Deterministic: by score, then weight, then key, so the same inputs always choose the same slot.
  return scores.sort(
    (a, b) =>
      b.score - a.score || b.slot.weight - a.slot.weight || a.slot.key.localeCompare(b.slot.key),
  );
}

/**
 * The slot to ask about next, or undefined when nothing is left worth asking — every slot is
 * filled, retired by skips, or scores at or below zero. The Studio ends the session then.
 */
export function selectSlot(options: SelectorOptions): SlotScore | undefined {
  const best = scoreSlots(options)[0];
  return best && best.score > 0 ? best : undefined;
}

/**
 * Gap-only candidates for hurry mode before School Packs exist (§5.2): the unfilled slots a
 * typical application needs most. Phase 3 replaces this with the chosen school's real prompts.
 */
export function gapOnlySlots(
  states: ReadonlyMap<SlotKey, SlotRecord>,
  context: NeedContext = {},
  limit = 12,
): SlotKey[] {
  return SLOTS.filter((entry) => {
    if (entry.reapplicantOnly && context.isReapplicant !== true) return false;
    const record = states.get(entry.key) ?? emptyRecord(entry.key);
    return record.state !== "filled";
  })
    .map((entry) => ({ entry, rank: entry.weight * DEFAULT_NEED(entry, context) }))
    .sort((a, b) => b.rank - a.rank || a.entry.key.localeCompare(b.entry.key))
    .slice(0, limit)
    .map(({ entry }) => entry.key);
}
