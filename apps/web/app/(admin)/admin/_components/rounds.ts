// Rounds as the console edits them. `school_cycles.rounds` stores a date per deadline and no time
// or zone (packages/db CycleRound), so the deadline's time and IANA zone are kept as the first line
// of the round's notes, "Due 17:00 America/New_York", and read back from it. Plain TS: unit-tested.

export interface StoredRound {
  name: string;
  deadline: string | null;
  decisionDate?: string | null;
  interviewInvitesWindow?: string | null;
  notes?: string | null;
}

export interface EditableRound {
  name: string;
  deadline: string;
  /** "HH:MM", 24-hour; empty when the school gives a date only. */
  time: string;
  /** IANA zone, e.g. "America/New_York"; empty when unknown. */
  timeZone: string;
  decisionDate: string;
  interviewInvitesWindow: string;
  notes: string;
}

const DUE = /^Due (\d{2}:\d{2}) ([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*)$/;

export function toEditable(round: StoredRound): EditableRound {
  const lines = (round.notes ?? "").split("\n");
  const due = DUE.exec(lines[0] ?? "");
  return {
    name: round.name,
    deadline: round.deadline ?? "",
    time: due?.[1] ?? "",
    timeZone: due?.[2] ?? "",
    decisionDate: round.decisionDate ?? "",
    interviewInvitesWindow: round.interviewInvitesWindow ?? "",
    notes: (due ? lines.slice(1) : lines).join("\n").trim(),
  };
}

export function toStored(round: EditableRound): StoredRound {
  const due = round.time && round.timeZone ? `Due ${round.time} ${round.timeZone}` : "";
  const notes = [due, round.notes.trim()].filter(Boolean).join("\n");
  return {
    name: round.name.trim(),
    deadline: round.deadline || null,
    decisionDate: round.decisionDate || null,
    interviewInvitesWindow: round.interviewInvitesWindow.trim() || null,
    notes: notes || null,
  };
}

export const EMPTY_ROUND: EditableRound = {
  name: "",
  deadline: "",
  time: "",
  timeZone: "",
  decisionDate: "",
  interviewInvitesWindow: "",
  notes: "",
};
