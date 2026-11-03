// Automated Studio runs against the synthetic applicants (spec §8.11, §16 Phase 1).
//
// Two modes:
//
//   "scripted"  — no model at all. The answer to a question is the ground-truth material for the
//                 slot the selector asked about. Deterministic and free, so a run of fifty sessions
//                 is something you can do on every change, and it exercises the parts that decide
//                 what gets asked: the slot selector, the slot-state rule, and the guard that a
//                 filled slot is never asked about again (§2 "no question is ever asked twice").
//
//   "live"      — the Haiku applicant simulator answers in character from the same ground truth,
//                 and the real Interviewer phrases the questions. This is the run that measures
//                 question quality and latency, and it needs an API key.
//
// Scripted mode is the one that can prove the §16 acceptance criterion about repeated questions,
// because the repetition guard is deterministic code. Live mode shows whether the *phrasing* ever
// asks for something already known, which only a model can get wrong.

import {
  SLOT_KEYS,
  emptyRecord,
  gapOnlySlots,
  questionsForSlot,
  selectSlot,
  type SlotKey,
  type SlotRecord,
} from "@admitstory/slots";
import { EXPRESS_OPENERS } from "@admitstory/slots";
import type { Fixture } from "./types";

export interface SimulatedTurn {
  index: number;
  slot: SlotKey;
  question: string;
  answer: string;
  /** Slots this answer filled, which is usually the one asked plus any the story also covers. */
  filled: SlotKey[];
  /** True when the fixture has nothing to say for this slot. */
  nothingToSay: boolean;
}

export interface SimulationResult {
  slug: string;
  turns: SimulatedTurn[];
  /** Slots asked about while already filled — the §16 criterion. Must be empty. */
  repeats: { slot: SlotKey; askedAtTurn: number; filledAtTurn: number }[];
  filledSlots: SlotKey[];
  storiesTold: string[];
  stoppedBecause: "nothing_left" | "turn_limit";
}

export interface SimulateOptions {
  /** Hard stop, so a bug cannot loop forever. */
  maxTurns?: number;
  /** Express mode asks the three openers first, then only the gaps (§5.2). */
  mode?: "express" | "standard" | "deep";
  /** Varies which story a fixture reaches for first, so fifty sessions are not one session fifty times. */
  seed?: number;
  /** "now", passed in so a run is reproducible. */
  now?: Date;
}

/** A tiny deterministic generator: a run with the same seed always goes the same way. */
function rng(seed: number): () => number {
  let state = (seed * 2654435761) % 4294967296;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** How this fixture would answer a question about a slot, drawn only from its ground truth. */
export function scriptedAnswer(
  fixture: Fixture,
  slot: SlotKey,
  told: ReadonlySet<string>,
  next: () => number,
): { answer: string; storyRef: string | null; filled: SlotKey[] } {
  const candidates = fixture.groundTruth.stories.filter(
    (story) => story.slots.includes(slot) && !told.has(story.ref),
  );
  if (candidates.length > 0) {
    const story = candidates[Math.floor(next() * candidates.length)] ?? candidates[0];
    if (story) {
      const answer = [
        story.situation,
        story.stakes,
        story.actions.join(" Then "),
        story.result,
        story.reflection,
      ]
        .filter((part) => part.trim() !== "")
        .join(" ");
      return {
        answer,
        storyRef: story.ref,
        // A story fills every slot it genuinely evidences, which is how one good answer closes
        // several questions at once.
        filled: story.slots.filter((key): key is SlotKey => SLOT_KEYS.includes(key as SlotKey)),
      };
    }
  }

  // Factual slots are answered from the facts rather than a story.
  const fact = fixture.groundTruth.facts.find((entry) =>
    slot.split(".").some((part) => part.length > 3 && entry.key.includes(part)),
  );
  if (fact) return { answer: `${fact.value}.`, storyRef: null, filled: [slot] };

  const goals = fixture.groundTruth.goals;
  const fromGoals: Partial<Record<string, string>> = {
    "goals.short_term": goals.shortTerm,
    "goals.long_term": goals.longTerm,
    "goals.plan_b": goals.planB,
    "why.now": goals.whyNow,
    "why.gap": goals.whyMba,
    "goals.origin": goals.whyMba,
  };
  const goalAnswer = fromGoals[slot];
  if (goalAnswer) return { answer: goalAnswer, storyRef: null, filled: [slot] };

  return { answer: "", storyRef: null, filled: [] };
}

/**
 * One scripted session. Returns every turn and, crucially, any slot that was asked about after it
 * was already filled — which is what §16's acceptance criterion forbids.
 */
export function simulateSession(fixture: Fixture, options: SimulateOptions = {}): SimulationResult {
  const maxTurns = options.maxTurns ?? 60;
  const mode = options.mode ?? fixture.profile.studioMode;
  const now = options.now ?? new Date(0);
  const next = rng(options.seed ?? 1);

  const states = new Map<SlotKey, SlotRecord>(SLOT_KEYS.map((key) => [key, emptyRecord(key)]));
  const filledAt = new Map<SlotKey, number>();
  const turns: SimulatedTurn[] = [];
  const repeats: SimulationResult["repeats"] = [];
  const told = new Set<string>();
  const context = { isReapplicant: fixture.profile.isReapplicant };

  let openersAsked = 0;
  let stoppedBecause: SimulationResult["stoppedBecause"] = "turn_limit";

  for (let index = 0; index < maxTurns; index += 1) {
    const opener = mode === "express" ? EXPRESS_OPENERS[openersAsked] : undefined;

    let slot: SlotKey;
    let question: string;
    if (opener) {
      slot = opener.targets[0] as SlotKey;
      question = opener.text;
      openersAsked += 1;
    } else {
      const picked = selectSlot({
        states,
        context,
        now,
        ...(mode === "express" ? { only: gapOnlySlots(states, context) } : {}),
      });
      if (!picked) {
        stoppedBecause = "nothing_left";
        break;
      }
      slot = picked.slot.key;
      question = questionsForSlot(slot)[0]?.text ?? `Tell me about ${slot}.`;
    }

    // The criterion: a slot that is already filled must never be asked about again.
    const asked = states.get(slot);
    if (asked?.state === "filled")
      repeats.push({ slot, askedAtTurn: index, filledAtTurn: filledAt.get(slot) ?? -1 });

    const { answer, storyRef, filled } = scriptedAnswer(fixture, slot, told, next);
    if (storyRef) told.add(storyRef);

    for (const key of filled) {
      const record = states.get(key) ?? emptyRecord(key);
      states.set(key, { ...record, state: "filled" });
      if (!filledAt.has(key)) filledAt.set(key, index);
    }

    // Nothing to say is a real answer: the slot is retired by a skip, not left to be re-asked.
    if (answer === "") {
      const record = states.get(slot) ?? emptyRecord(slot);
      states.set(slot, { ...record, skippedCount: record.skippedCount + 1, lastAskedAt: now });
    }

    turns.push({ index, slot, question, answer, filled, nothingToSay: answer === "" });
  }

  return {
    slug: fixture.profile.slug,
    turns,
    repeats,
    filledSlots: [...states.entries()]
      .filter(([, record]) => record.state === "filled")
      .map(([key]) => key),
    storiesTold: [...told],
    stoppedBecause,
  };
}

export interface SuiteResult {
  sessions: SimulationResult[];
  totalRepeats: number;
  /** Median turns to fill the slots a typical application needs. */
  medianTurns: number;
}

/**
 * The §16 run: every fixture, several seeds each, to at least `sessions` sessions. Fifty sessions
 * over twelve applicants means each one is run with four or five different orderings, which is what
 * catches an ordering-dependent repetition.
 */
export function simulateSuite(
  fixtures: readonly Fixture[],
  sessions = 50,
  options: SimulateOptions = {},
): SuiteResult {
  if (fixtures.length === 0) return { sessions: [], totalRepeats: 0, medianTurns: 0 };
  const results: SimulationResult[] = [];
  for (let index = 0; index < sessions; index += 1) {
    const fixture = fixtures[index % fixtures.length];
    if (!fixture) continue;
    results.push(
      simulateSession(fixture, {
        ...options,
        seed: Math.floor(index / fixtures.length) + 1,
      }),
    );
  }
  const lengths = results.map((result) => result.turns.length).sort((a, b) => a - b);
  const middle = Math.floor(lengths.length / 2);
  return {
    sessions: results,
    totalRepeats: results.reduce((sum, result) => sum + result.repeats.length, 0),
    medianTurns:
      lengths.length % 2 === 0
        ? ((lengths[middle - 1] ?? 0) + (lengths[middle] ?? 0)) / 2
        : (lengths[middle] ?? 0),
  };
}
