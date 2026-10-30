// Slot state (spec §10 `slots_state`, Appendix C's closing rule): a slot is **filled** when at
// least one confirmed story is linked to it — or, for factual slots, when confirmed facts are —
// and **partial** when only partial stories are. Derived in code from the dossier, never set by a
// model, so "we already know this" can never be a hallucination.

import { isSlotKey, slot, type SlotKey } from "./slots";

export const SLOT_STATES = ["empty", "partial", "filled"] as const;

export type SlotState = (typeof SLOT_STATES)[number];

export interface SlotRecord {
  slotKey: SlotKey;
  state: SlotState;
  /** Stories (or, for factual slots, facts) that evidence it. */
  evidenceIds: readonly string[];
  /** When the Interviewer last asked for this slot. */
  lastAskedAt?: Date | null;
  /** How many times the applicant said "skip for now" to it. */
  skippedCount: number;
}

/** What the dossier knows, in the shape the state rule needs. */
export interface SlotEvidence {
  slotKey: string;
  evidenceId: string;
  /** A confirmed story (or confirmed fact) fills a slot; a partial one only makes it partial. */
  confirmed: boolean;
}

export function emptyRecord(slotKey: SlotKey): SlotRecord {
  return { slotKey, state: "empty", evidenceIds: [], lastAskedAt: null, skippedCount: 0 };
}

/**
 * Recomputes every slot's state from the evidence linked to it, keeping the asked/skipped history
 * from the existing records. Evidence for an unknown slot key is ignored rather than throwing: a
 * model may propose a slot name that no longer exists, and that must not break a Studio turn.
 */
export function deriveStates(
  evidence: readonly SlotEvidence[],
  existing: readonly SlotRecord[] = [],
): Map<SlotKey, SlotRecord> {
  const history = new Map(existing.map((record) => [record.slotKey, record] as const));
  const states = new Map<SlotKey, SlotRecord>();

  for (const record of existing)
    states.set(record.slotKey, { ...record, state: "empty", evidenceIds: [] });

  for (const item of evidence) {
    if (!isSlotKey(item.slotKey)) continue;
    const previous =
      states.get(item.slotKey) ?? history.get(item.slotKey) ?? emptyRecord(item.slotKey);
    const ids = previous.evidenceIds.includes(item.evidenceId)
      ? previous.evidenceIds
      : [...previous.evidenceIds, item.evidenceId];
    states.set(item.slotKey, {
      ...previous,
      evidenceIds: ids,
      state: item.confirmed ? "filled" : previous.state === "filled" ? "filled" : "partial",
    });
  }

  return states;
}

/** Spec §5.2: 1.0 empty, 0.5 partial, 0 filled. */
export function emptiness(state: SlotState): number {
  switch (state) {
    case "empty":
      return 1;
    case "partial":
      return 0.5;
    case "filled":
      return 0;
  }
}

/** A slot the Interviewer must not ask about again, because the answer is already known. */
export function isKnown(record: SlotRecord): boolean {
  return record.state === "filled";
}

/** Human-readable reason a slot is still open, for the Studio's "what's still thin" summary. */
export function openness(record: SlotRecord): string {
  const { factual } = slot(record.slotKey);
  if (record.state === "filled") return "covered";
  if (record.state === "partial")
    return factual ? "stated but not confirmed" : "a story without its detail yet";
  return factual ? "not stated yet" : "no story yet";
}
