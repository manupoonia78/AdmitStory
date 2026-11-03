// Screen H's words and the pure helpers behind them (spec §5.11, §6.10 H; design direction
// docs/design/phase-6-direction.md). No React and no Zod here, so the list, the stories, the
// brief sheet, the coverage board, the status tab and Home all read their copy from one place
// and say the same thing in the same way (§6.9).
//
// Two rules this file keeps: the applicant never sees what a recommender wrote, and the invite
// link is never shown to the applicant (plan §1.7). Nothing here renders a token or a URL.

import type {
  BriefSummary,
  RecommenderStatus,
  Relationship,
  ReminderKind,
  ReminderView,
} from "@admitstory/shared/kit";
import {
  LOR_STORIES_MAX,
  LOR_STORIES_MIN,
  RECOMMENDER_STATUS_LABELS,
  RELATIONSHIP_LABELS,
  REMINDER_LABELS,
} from "@admitstory/shared/kit";
import type { StatusTone } from "../components/status-label";
import { formatDay, type Instant } from "../strategy/time-scale";

/* Tabs ----------------------------------------------------------------------------------------- */

export const RECOMMENDER_TABS = [
  { id: "stories", label: "Stories" },
  { id: "brief", label: "Brief" },
  { id: "coverage", label: "Coverage" },
  { id: "status", label: "Status and reminders" },
] as const;

export type RecommenderTabId = (typeof RECOMMENDER_TABS)[number]["id"];

/** The tab in a ?tab= parameter, or "stories". */
export function tabFromParam(value: string | null | undefined): RecommenderTabId {
  return RECOMMENDER_TABS.some((tab) => tab.id === value) ? (value as RecommenderTabId) : "stories";
}

/* Names and dates ------------------------------------------------------------------------------ */

/** "Ravi Menon" → "Ravi". Everything the screens say to the applicant uses the first name. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

/** "12 Sep 2026" in the applicant's time zone (the house date rule, §5.5). */
export function onDate(at: Instant, timeZone: string): string {
  return formatDay(at, timeZone);
}

/** "Manager, Meridian Health Systems" — relationship first, because that is what schools ask. */
export function roleLine(person: {
  relationship: Relationship;
  title?: string | null;
  organisation?: string | null;
}): string {
  return [RELATIONSHIP_LABELS[person.relationship], person.title, person.organisation]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");
}

/* Status ---------------------------------------------------------------------------------------- */

/** Not invited is the one status that needs the applicant; submitted is the one that is done. */
export const STATUS_TONES: Record<RecommenderStatus, StatusTone> = {
  not_invited: "needs",
  invited: "neutral",
  opened: "neutral",
  in_progress: "neutral",
  submitted: "verified",
};

export function statusWord(status: RecommenderStatus): string {
  return RECOMMENDER_STATUS_LABELS[status];
}

/**
 * The privacy line screen H shows the applicant, verbatim from the plan (§8). Named for its side
 * of the Kit: the portal has its own `privacyLine`, written to the recommender.
 */
export function recommenderPrivacyLine(first: string): string {
  return `${first}'s notes and letter stay private to ${first}. You'll only see whether the brief was opened, whether ${first} has started, and when they mark it submitted.`;
}

/* Stories --------------------------------------------------------------------------------------- */

/** "5 of 5–7 stories". The en dash is deliberate. */
export function storyCountLine(count: number): string {
  return `${count} of ${LOR_STORIES_MIN}–${LOR_STORIES_MAX} ${count === 1 ? "story" : "stories"}`;
}

/** One tick per story a recommender could tell: always at least the five they need. */
export function storyTicks(count: number): boolean[] {
  const length = Math.max(LOR_STORIES_MIN, Math.min(count, LOR_STORIES_MAX));
  return Array.from({ length }, (_, index) => index < count);
}

/** What to do next about the story count, or null when it sits in range. */
export function storyCountHint(count: number, first: string): string | null {
  if (count === 0) return `Tell ${first}'s stories and they become the brief.`;
  if (count < LOR_STORIES_MIN) {
    const short = LOR_STORIES_MIN - count;
    return `${short === 1 ? "One more" : `${short} more`} and ${first} has enough to choose from.`;
  }
  if (count > LOR_STORIES_MAX)
    return `That's more than a letter can carry. The brief uses the strongest ${LOR_STORIES_MAX}.`;
  return null;
}

/* Briefs ---------------------------------------------------------------------------------------- */

export interface StateWord {
  tone: StatusTone;
  word: string;
}

/** A brief's state in words, never colour alone (§6.3). */
export function briefStateWord(brief: Pick<BriefSummary, "status" | "stale">): StateWord {
  if (brief.status === "building") return { tone: "neutral", word: "Building" };
  if (brief.status === "failed") return { tone: "risk", word: "Didn't finish" };
  if (brief.status === "none") return { tone: "needs", word: "Not built yet" };
  return brief.stale
    ? { tone: "needs", word: "Changed since it was built" }
    : { tone: "verified", word: "Ready" };
}

/** The group's name on the switcher: "Your other schools" for the shared common-form brief. */
export function groupLabel(schools: readonly string[]): string {
  if (schools.length === 0) return "Your schools";
  if (schools.length === 1) return schools[0] ?? "Your schools";
  return `${schools.slice(0, -1).join(", ")} and ${schools[schools.length - 1]}`;
}

/** "Building Ravi's brief from 6 stories. About a minute." */
export function buildingLine(first: string, stories: number): string {
  return `Building ${first}'s brief from ${stories} ${stories === 1 ? "story" : "stories"}. About a minute.`;
}

export function failedLine(first: string): string {
  return `${first}'s brief didn't finish. Your stories are saved. Build it again?`;
}

/** "Your stories changed since this brief was built on 12 Oct. Build it again? It uses one refinement." */
export function staleLine(
  builtAt: Instant | null,
  costsRefinement: boolean,
  timeZone: string,
): string {
  const when = builtAt ? ` on ${onDate(builtAt, timeZone)}` : "";
  const cost = costsRefinement ? "It uses one refinement." : "It's free.";
  return `Your stories changed since this brief was built${when}. Build it again? ${cost}`;
}

/** The button that rebuilds, named after what it does (§6.9). */
export function rebuildLabel(first: string): string {
  return `Build ${first}'s brief again`;
}

/* Reminders --------------------------------------------------------------------------------------- */

export const REMINDER_STATE_WORDS: Record<ReminderView["state"], StateWord> = {
  suggested: { tone: "neutral", word: "Suggested" },
  on: { tone: "verified", word: "On" },
  sent: { tone: "verified", word: "Sent" },
  skipped: { tone: "neutral", word: "Skipped" },
  changed: { tone: "needs", word: "Changed since you read it" },
  off: { tone: "neutral", word: "Off" },
};

export function reminderLabel(kind: ReminderKind): string {
  return REMINDER_LABELS[kind];
}

/** Why "Turn on" is disabled, or null when it can be turned on. */
export function reminderBlockedReason(
  reminder: Pick<ReminderView, "state" | "previewed">,
): string | null {
  if (reminder.state === "sent") return "This one has already gone.";
  if (reminder.state === "skipped") return "This one was skipped.";
  if (!reminder.previewed) return "Read it first, then you can turn it on.";
  return null;
}

/* Empty, locked and the page's own words --------------------------------------------------------- */

export const RECOMMENDERS_COPY = {
  title: "Recommenders",
  lead: "Each person who writes for you gets a brief of their own: the stories they saw, your schools' questions and the dates.",
  emptyTitle: "No recommenders yet",
  emptyBody: "Add the two people who know your work best, and each gets a brief of their own.",
  emptyAction: "Add a recommender",
  lockedTitle: "Recommender briefs come with a School Kit",
  lockedBody: "Unlock a school and you can brief your recommenders.",
  lockedAction: "See your schools",
  listHeading: "Your recommenders",
  pickOne: "Pick a recommender to see their stories, their brief and where things stand.",
  neverShared:
    "We never show you their notes or their letter, and the private link goes only to their own email.",
} as const;

/** "Recommenders: 1 of 2 invited" for Home, when the server hasn't already worded it. */
export function recommenderSchoolLine(school: {
  needed: number | null;
  named: number;
  invited: number;
  label?: string;
}): string {
  if (school.label) return school.label;
  const of = school.needed === null ? school.named : school.needed;
  return `Recommenders: ${school.invited} of ${of} invited`;
}
