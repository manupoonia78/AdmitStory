// The deadline horizon's model (spec §5.5, §6.7 School Strategy): where each round falls on the
// shared time axis, what it says in words, and how keyboard selection moves. Pure and server-safe,
// so the timeline, its list equivalent and its placeholder all agree, and tests need no DOM.

import { verifiedText } from "./citation";
import {
  daysLeftText,
  daysUntil,
  formatDay,
  formatDeadline,
  monthTicks,
  positionIn,
  timeDomain,
  toMs,
  type Instant,
  type MonthTick,
} from "./time-scale";
import type { HorizonSchool } from "./types";

export interface HorizonMark {
  id: string;
  /** "R1". */
  short: string;
  /** The few characters drawn on the axis: "R1", "EA", "D3" (see `roundCode`). */
  code: string;
  /** "Round 1". */
  label: string;
  /** 0 to 1 along the axis. */
  at: number;
  /** "8 Sep". */
  day: string;
  /** "8 Sep 2026, 23:59 GMT-4" in the applicant's time zone. */
  deadline: string;
  daysLeft: number;
  /** "12 days left", "Due today", "Passed". */
  daysLeftText: string;
  past: boolean;
  planned: boolean;
}

export interface HorizonLane {
  id: string;
  name: string;
  pack: HorizonSchool["pack"];
  /** "Verified 12 Sep 2026", or null for a school without a published pack. */
  verified: string | null;
  /** Where the deadlines come from: "Deadlines page, 2026". */
  source: string | null;
  marks: HorizonMark[];
}

export interface HorizonModel {
  lanes: HorizonLane[];
  ticks: MonthTick[];
  /** Today, 0 to 1 along the axis. */
  today: number;
}

export interface HorizonOptions {
  now: Instant;
  /** The applicant's IANA time zone, "Asia/Kolkata". */
  timeZone: string;
  locale?: string;
}

export function horizonModel(
  schools: readonly HorizonSchool[],
  { now, timeZone, locale = "en-GB" }: HorizonOptions,
): HorizonModel {
  const dates = schools.flatMap((school) =>
    school.pack === "published" ? school.rounds.map((round) => round.deadline) : [],
  );
  const domain = timeDomain(dates, now);
  const nowMs = toMs(now);
  const lanes = schools.map((school): HorizonLane => {
    if (school.pack !== "published") {
      return {
        id: school.id,
        name: school.name,
        pack: school.pack,
        verified: null,
        source: null,
        marks: [],
      };
    }
    const marks = [...school.rounds]
      .sort((a, b) => toMs(a.deadline) - toMs(b.deadline))
      .map((round): HorizonMark => {
        const days = daysUntil(round.deadline, now, timeZone);
        return {
          id: round.id,
          short: round.short,
          code: roundCode(round.short, round.label),
          label: round.label,
          at: positionIn(domain, round.deadline),
          day: formatDay(round.deadline, timeZone, locale, false),
          deadline: formatDeadline(round.deadline, timeZone, locale),
          daysLeft: days,
          daysLeftText: daysLeftText(days),
          past: toMs(round.deadline) < nowMs,
          planned: school.plannedRoundId === round.id,
        };
      });
    return {
      id: school.id,
      name: school.name,
      pack: school.pack,
      verified: verifiedText(school.citation, locale),
      source: `${school.citation.source}, ${school.citation.year}`,
      marks,
    };
  });
  return { lanes, ticks: monthTicks(domain, locale), today: positionIn(domain, now) };
}

/**
 * A round's name cut to what fits under its dot on the axis: "Round 2" is "R2", "Early Action" is
 * "EA", HEC's "September 2027 intake, deadline 3" is "D3". The full name stays in the lane's
 * accessible name and in the dot's hover label, so nothing is lost by the shortening.
 */
export function roundCode(short: string, label = short): string {
  const name = `${short} ${label}`;
  // Named rounds first: "2+2 Round" would otherwise read as Round 2.
  if (/2\s*\+\s*2/.test(name)) return "2+2";
  if (/early\s+action/i.test(name)) return "EA";
  if (/early\s+decision/i.test(name)) return "ED";
  if (/consortium/i.test(name)) return "CE";
  if (/deferred/i.test(name)) return "DA";
  if (/rolling/i.test(name)) return "Roll";
  const deadline = /\bdeadline\s*(\d+)\b/i.exec(name);
  if (deadline) return `D${deadline[1]}`;
  const round = /\b(?:R|Round\s*)(\d+)\b/i.exec(name);
  if (round) return `R${round[1]}`;
  const trimmed = short.trim();
  if (trimmed.length <= 4) return trimmed;
  const initials = trimmed
    .split(/[\s,–-]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return initials.slice(0, 3) || trimmed.slice(0, 4);
}

/** How a mark's label sits on the axis: under the line, over it, or left off for lack of room. */
export type LabelSlot = "below" | "above" | "hidden";

/** Roughly how wide a label in text-sm tabular figures is, in px. */
function labelWidth(text: string): number {
  return text.length * 8 + 10;
}

/**
 * Where each mark's label goes on a track `trackPx` wide, so no two labels touch. Labels alternate
 * under and over the line as marks crowd; one that would still collide with both neighbours is
 * left off (its dot keeps a hover label, and the dates are in words for assistive technology). The
 * planned round always keeps its label.
 */
export function labelSlots(
  marks: readonly Pick<HorizonMark, "at" | "code" | "planned">[],
  trackPx: number,
): LabelSlot[] {
  const slots: LabelSlot[] = marks.map(() => "hidden");
  const order = marks
    .map((mark, index) => ({ mark, index }))
    // The planned round is placed first, so a crowd never takes its label.
    .sort((a, b) => Number(b.mark.planned) - Number(a.mark.planned) || a.mark.at - b.mark.at);
  const placed: { start: number; end: number; slot: "below" | "above" }[] = [];
  for (const { mark, index } of order) {
    const width = labelWidth(mark.code);
    const centre = mark.at * trackPx;
    const start = centre - width / 2;
    const end = centre + width / 2;
    const free = (slot: "below" | "above") =>
      placed.every((p) => p.slot !== slot || end + 6 <= p.start || start >= p.end + 6);
    const slot = free("below") ? "below" : free("above") ? "above" : null;
    if (!slot) continue;
    placed.push({ start, end, slot });
    slots[index] = slot;
  }
  return slots;
}

/**
 * Which month ticks keep their label on a track `trackPx` wide: every month when there is room,
 * otherwise every second or third, always keeping the first. Ticks without a label keep their rule.
 */
export function tickLabelEvery(ticks: readonly MonthTick[], trackPx: number): number {
  const [first, second] = ticks;
  if (!first || !second) return 1;
  const widest = Math.max(...ticks.map((tick) => labelWidth(tick.label)));
  const gap = (second.at - first.at) * trackPx;
  if (gap <= 0) return 1;
  return Math.max(1, Math.ceil((widest + 8) / gap));
}

/** "Round 2, 6 Jan 2027, 23:59 GMT+5:30, 67 days left, your planned round". */
export function markSummary(mark: HorizonMark): string {
  const parts = [mark.label, mark.deadline, mark.daysLeftText];
  if (mark.planned) parts.push("your planned round");
  return parts.join(", ");
}

/** The lane's accessible name: the school and every round in words. */
export function laneSummary(lane: HorizonLane): string {
  if (lane.pack !== "published") return `${lane.name}, pack coming soon`;
  if (lane.marks.length === 0) return `${lane.name}, no rounds published`;
  return `${lane.name}. ${lane.marks.map(markSummary).join(". ")}`;
}

/* Selection ----------------------------------------------------------------------------------- */

/** Comparing takes two or more schools (spec §6.7). */
export const COMPARE_AT = 2;

export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((one) => one !== id) : [...selected, id];
}

/**
 * The order lanes appear in: while comparing, the selected schools come first as columns and the
 * rest fold beneath them; otherwise the schools' own order. Keyboard movement follows it.
 */
export function visualOrder(ids: readonly string[], selected: readonly string[]): string[] {
  if (selected.length < COMPARE_AT) return [...ids];
  const chosen = ids.filter((id) => selected.includes(id));
  return [...chosen, ...ids.filter((id) => !selected.includes(id))];
}

/** Where a key moves focus in a list of `count`, or null when the key doesn't move it. */
export function moveIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return Math.min(index + 1, count - 1);
    case "ArrowUp":
    case "ArrowLeft":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** "Northfield", "Northfield and Harbor", "Northfield, Harbor and Westbridge". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What the live region says after the selection changes. */
export function selectionAnnouncement(names: readonly string[]): string {
  if (names.length === 0) return "No schools selected.";
  if (names.length < COMPARE_AT) return `${joinNames(names)} selected. Select one more to compare.`;
  return `Comparing ${joinNames(names)}.`;
}
