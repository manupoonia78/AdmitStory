import "server-only";

import { getDb, listFacts, listSlotStates, listStories, type Story } from "@admitstory/db";
import {
  SLOTS,
  coverage,
  deriveStates,
  emptyRecord,
  type CoverageBar,
  type SlotEvidence,
  type SlotKey,
  type SlotRecord,
} from "@admitstory/slots";
import { SLOT_KEYS, isSlotKey } from "@admitstory/slots";
import type { LensId } from "@admitstory/shared";

// The Studio's view of what is already known. Slot states are derived from the dossier on every
// read rather than trusted from the table (Appendix C's rule is the source of truth), so the
// Interviewer can never be told a slot is empty when a confirmed story already fills it — which is
// what makes "no question is ever asked twice" (§2) hold.

export interface StudioKnowledge {
  states: Map<SlotKey, SlotRecord>;
  stories: Story[];
  coverage: CoverageBar[];
  factCount: number;
  confirmedFactCount: number;
  conflictCount: number;
}

function evidenceFrom(stories: readonly Story[]): SlotEvidence[] {
  const evidence: SlotEvidence[] = [];
  for (const story of stories) {
    if (story.mergedInto !== null) continue;
    for (const slotKey of story.slotKeys) {
      if (!isSlotKey(slotKey)) continue;
      evidence.push({
        slotKey,
        evidenceId: story.id,
        confirmed: story.status === "confirmed",
      });
    }
  }
  return evidence;
}

export async function loadKnowledge(userId: string): Promise<StudioKnowledge> {
  const db = getDb();
  const [slotRows, stories, facts] = await Promise.all([
    listSlotStates(db, userId),
    listStories(db, userId),
    listFacts(db, userId),
  ]);

  const history: SlotRecord[] = slotRows
    .filter((row) => isSlotKey(row.slotKey))
    .map((row) => ({
      slotKey: row.slotKey as SlotKey,
      state: row.state,
      evidenceIds: row.evidenceStoryIds,
      lastAskedAt: row.lastAskedAt,
      skippedCount: row.skippedCount,
    }));

  const derived = deriveStates(evidenceFrom(stories), history);
  // Every slot needs a record, including ones never touched, so the selector sees them as empty.
  const states = new Map<SlotKey, SlotRecord>();
  for (const key of SLOT_KEYS) states.set(key, derived.get(key) ?? emptyRecord(key));

  // A factual slot is filled by confirmed facts rather than by a story (Appendix C's closing
  // rule), so those are derived from the Fact Sheet here rather than from the stored state.
  const confirmedKeys = facts
    .filter((fact) => fact.status === "confirmed")
    .map((fact) => fact.key.toLowerCase());
  const statedKeys = facts.map((fact) => fact.key.toLowerCase());
  for (const entry of SLOTS) {
    if (!entry.factual || !entry.factKeys) continue;
    const matches = (keys: readonly string[]) =>
      keys.some((key) => entry.factKeys?.some((pattern) => key.includes(pattern)));
    const state = matches(confirmedKeys) ? "filled" : matches(statedKeys) ? "partial" : "empty";
    if (state === "empty") continue;
    const record = states.get(entry.key) ?? emptyRecord(entry.key);
    // Never downgrade: a confirmed story already linked to the slot wins.
    if (record.state === "filled") continue;
    states.set(entry.key, { ...record, state });
  }

  return {
    states,
    stories,
    coverage: coverage({
      stories: stories
        .filter((story) => story.mergedInto === null)
        .map((story) => ({
          id: story.id,
          lenses: story.lenses as LensId[],
          confirmed: story.status === "confirmed",
        })),
      states,
    }),
    factCount: facts.length,
    confirmedFactCount: facts.filter((fact) => fact.status === "confirmed").length,
    conflictCount: facts.filter((fact) => fact.status === "conflict").length,
  };
}
