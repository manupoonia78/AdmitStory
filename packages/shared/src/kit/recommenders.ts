// The Recommender Kit (spec §5.11, Appendix F, canon A11 lor.md), Phase 6: plain types, constants
// and pure helpers shared by the AI layer, the app, screen H and the recommender portal. Zod-free,
// so client components may import it; the validators are in `@admitstory/ai` (schemas/lor.ts),
// checked against these types.
//
// Two rules shape everything here:
// - The product never writes a letter for the applicant. A brief is facts and talking points; the
//   portal assistant works only from the recommender's own notes (decision 2, LOR-01, LOR-10).
// - The applicant sees status, never content: notes, letters and the portal link stay with the
//   recommender (§14.3, decisions 7 and 8).

import { traitLabel, type TraitId } from "../traits";
import type { Cite, LorBrief } from "./types";

/* Relationships (§5.11) ------------------------------------------------------------------------ */

export const RELATIONSHIPS = [
  "manager",
  "former_manager",
  "client",
  "cross_functional_partner",
  "extracurricular_leader",
  "other",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  manager: "Manager",
  former_manager: "Former manager",
  client: "Client",
  cross_functional_partner: "Cross-functional partner",
  extracurricular_leader: "Extracurricular leader",
  other: "Someone else",
};

/* Intake (Appendix F, decision 11) ------------------------------------------------------------- */

export const INTAKE_QUESTION_IDS = [
  "how_you_know",
  "strengths",
  "stories",
  "feedback",
  "said_to_others",
  "background",
  "logistics",
] as const;
export type IntakeQuestionId = (typeof INTAKE_QUESTION_IDS)[number];

export interface IntakeQuestion {
  id: IntakeQuestionId;
  /** The question, addressed to the applicant about one recommender (their first name). */
  prompt: (first: string) => string;
  /** One quiet line under the question. */
  hint: string;
  /** "stories" takes one answer per story (5–7); every other question takes one answer. */
  repeatable: boolean;
}

/** Appendix F's seven intake questions, in order, as plain warm copy (§6.9). */
export const INTAKE_QUESTIONS: readonly IntakeQuestion[] = [
  {
    id: "how_you_know",
    prompt: (first) =>
      `How does ${first} know your work? Their role, how long you've worked together and how often. Did ${first} ever choose you for something, like a team, a project or an award?`,
    hint: "A moment they trusted you with something says more than dates.",
    repeatable: false,
  },
  {
    id: "strengths",
    prompt: (first) =>
      `What would ${first} say you do better than anyone similar they've worked with? Two to four things, and the moment ${first} saw each one.`,
    hint: "Think of what they'd tell a colleague about you, not your job description.",
    repeatable: false,
  },
  {
    id: "stories",
    prompt: (first) =>
      `Tell one story ${first} saw for themselves: what happened, what ${first} saw, what you did, how it turned out (with numbers), and anything ${first} said at the time.`,
    hint: "Five to seven stories in all, one at a time. Rough is fine.",
    repeatable: true,
  },
  {
    id: "feedback",
    prompt: (first) =>
      `What's a piece of constructive feedback ${first} gave you? The situation, what ${first} said, how you took it, what you did next, and how you know it got better.`,
    hint: "Pick something you could learn, not something about who you are.",
    repeatable: false,
  },
  {
    id: "said_to_others",
    prompt: (first) =>
      `Has ${first} said anything about you to other people? A review, a nomination, a compliment someone passed on.`,
    hint: "Their words help most when you remember them closely.",
    repeatable: false,
  },
  {
    id: "background",
    prompt: (first) =>
      `Does ${first} know how MBA admissions work? Have they written letters before, or worked with people from your schools?`,
    hint: "If not, the brief explains what schools look for.",
    repeatable: false,
  },
  {
    id: "logistics",
    prompt: (first) =>
      `How would ${first} like to get the brief, and when is a good time to remind them?`,
    hint: "Deadlines come from your schools, so you don't need to list them.",
    repeatable: false,
  },
];

/** LOR-02 and Appendix F: 5–7 stories per recommender, 2–4 strengths. */
export const LOR_STORIES_MIN = 5;
export const LOR_STORIES_MAX = 7;
export const LOR_STRENGTHS_MIN = 2;
export const LOR_STRENGTHS_MAX = 4;

/** One story a recommender saw for themselves, as the applicant told it at intake. */
export interface LorStoryFields {
  title: string;
  what_happened: string;
  /** What the recommender saw directly: the part only they can vouch for. */
  what_they_saw: string;
  your_actions: string[];
  result: string;
  /** Numbers exactly as the applicant gave them. */
  numbers: string[];
  /** Words the recommender said at the time, only when the applicant quoted them. */
  what_they_said: string | null;
  traits: TraitId[];
  /** Dossier F/S/L codes that tell the same events. */
  cites: Cite[];
}

/** LOR-06: a trainable development area as a full arc, feedback to evidence. */
export interface LorGrowthArc {
  feedback: string;
  response: string;
  steps: string[];
  evidence: string;
  cites: Cite[];
}

/** `lor.extract` output: what the intake answers say, structured. */
export interface LorIntake {
  relationship: { summary: string; chose_you_for: string | null; cites: Cite[] };
  strengths: { trait: TraitId; moment: string; story_ref: string | null }[];
  /** `ref` is "s1", "s2"… within this output; stored stories get R codes. */
  stories: (LorStoryFields & { ref: string })[];
  growth: LorGrowthArc | null;
  said_to_others: string[];
  background: { knows_mba: "yes" | "no" | "unknown"; note: string | null };
  logistics: { prefers: string | null; remind_when: string | null };
  /** What the answers didn't cover, as a question to ask the applicant. */
  missing: { question_id: IntakeQuestionId; ask: string }[];
}

/** The intake as stored on the recommender: stories live in `lor_stories`, strengths point at R codes. */
export type StoredIntake = Omit<LorIntake, "stories" | "strengths"> & {
  strengths: { trait: TraitId; moment: string; story: string | null }[];
};

/* Coverage plan (`lor.plan`, LOR-03) ----------------------------------------------------------- */

export interface LorFacet {
  story: Cite;
  /** The side of the story this recommender covers ("how he persuaded the vendor"). */
  facet: string;
  evidence: string;
}

export interface LorAssignment {
  /** The recommender's ref ("rec1"). */
  recommender: string;
  strengths: TraitId[];
  stories: Cite[];
  facets: LorFacet[];
  avoid: { story: Cite; facet: string; because: "essay" | "other_recommender"; where: string }[];
}

export interface LorPlan {
  assignments: LorAssignment[];
  red_flags: { flag: string; recommender: string; how: string }[];
  warnings: string[];
}

/* Brief: deterministic meta, rendered with the model's LorBrief (decision 14) ------------------- */

/** Every school that uses the common form shares one brief (decision 15). */
export const COMMON_GROUP_KEY = "common";

export interface CommonLorQuestion {
  id: string;
  text: string;
  /** Shown as given ("About 500 words"); the common form recommends rather than enforces. */
  limit: string | null;
  /** The recommended word count, for the portal's live count. */
  words: number | null;
}

/**
 * The GMAC Common Letter of Recommendation's narrative questions (decision 16). Packs with
 * `format: "gmac_common"` list none, so they live in code. MANU MUST VERIFY this wording against
 * the current GMAC form before launch, then set COMMON_LOR_SOURCE.verifiedAt.
 */
export const COMMON_LOR_QUESTIONS: readonly CommonLorQuestion[] = [
  {
    id: "c1",
    text: "Please provide a brief description of your interaction with the applicant and, if applicable, the applicant's team.",
    limit: "About 50 words",
    words: 50,
  },
  {
    id: "c2",
    text: "How does the candidate's performance compare to those of other well-qualified individuals in similar roles? Please provide specific examples.",
    limit: "About 500 words",
    words: 500,
  },
  {
    id: "c3",
    text: "Describe the most important piece of constructive feedback you have given the applicant. Please detail the circumstances and the applicant's response.",
    limit: "About 500 words",
    words: 500,
  },
];

/** Where COMMON_LOR_QUESTIONS come from. `verifiedAt` stays null until Manu checks the wording. */
export const COMMON_LOR_SOURCE: { label: string; url: string; verifiedAt: string | null } = {
  label: "GMAC Common Letter of Recommendation",
  url: "https://www.gmac.com/",
  verifiedAt: null,
};

/** LOR-09: five plain bullets for a recommender with no MBA background. Never language to copy. */
export const LOR_ADMISSIONS_EXPLAINER: readonly string[] = [
  "Specific moments you saw yourself: what happened, what they did, and what changed because of it.",
  "How they compare with other strong people you've worked with in a similar role.",
  "Leadership in practice: ideas they started, people they brought round, teams they pulled together.",
  "One piece of feedback you gave them, and what they did with it.",
  "Your own voice. A measured, honest letter in your words reads better than a polished one.",
];

/** Appendix F's "how to use this brief", worded per §6.9. */
export const OWN_WORDS_REMINDER =
  "These are facts and memories to jog yours. Please write in your own words: schools ask that the letter is entirely yours.";

export interface BriefQuestion {
  id: string;
  /** Verbatim: from the pack, or the common form's wording. */
  text: string;
  limit: string | null;
  source: "pack" | "common_form";
}

export type LorFormat = "gmac_common" | "school_specific" | "unknown";

export interface BriefSchoolMeta {
  schoolCycleId: string;
  school: string;
  round: string | null;
  /** ISO date. */
  deadline: string | null;
  format: LorFormat;
  howToSubmit: string;
  packNotes: string[];
  questions: BriefQuestion[];
}

export interface BriefMeta {
  applicant: { name: string; firstName: string };
  recommender: {
    name: string;
    firstName: string;
    title: string | null;
    organisation: string | null;
  };
  groupKey: string;
  schools: BriefSchoolMeta[];
  /** ISO date the applicant should ask by (applicant-only). */
  askBy: string | null;
  /** ISO dates of the planned check-ins. */
  checkIns: string[];
  /** ISO time. */
  builtAt: string;
}

export interface BriefPoint {
  point: string;
  evidence: string;
  /** The trait's plain label. */
  trait: string;
  story: Cite | null;
  cites: Cite[];
}

export type BriefSection =
  | { kind: "note"; heading: string; text: string }
  | { kind: "reminder"; heading: string; text: string }
  | { kind: "explainer"; heading: string; bullets: readonly string[] }
  | {
      kind: "school";
      heading: string;
      deadline: string | null;
      howToSubmit: string;
      packNotes: string[];
      questions: {
        id: string;
        text: string;
        limit: string | null;
        points: BriefPoint[];
      }[];
    }
  | { kind: "traits"; heading: string; items: { trait: string; why: string; cites: Cite[] }[] }
  | { kind: "covers"; heading: string; items: string[] }
  | { kind: "arc"; heading: string; steps: { label: string; text: string }[] }
  | { kind: "facts"; heading: string; items: { text: string; cites: Cite[] }[] }
  | { kind: "timeline"; heading: string; items: { date: string; text: string }[] };

/** Codes that leaked into prose, "(S01)" or "[F02, R03]": removed for the recommender. */
const CODE_GROUP = /\s*[([]\s*[FSLPCKR]\d{1,6}(?:\s*[,;/]\s*[FSLPCKR]\d{1,6})*\s*[)\]]/g;

const safeTraitLabel = (trait: string): string => {
  try {
    return traitLabel(trait as TraitId);
  } catch {
    return trait.replace(/_/g, " ");
  }
};

/**
 * One source of brief structure and copy for screen H, the portal, the PDF and the email text.
 * The questions come from `meta` (verbatim, from code), the talking points from the model's brief,
 * matched by question id. Audience "recommender" drops every cite, every story code and the
 * applicant-only data (the ask-by date); "applicant" keeps cites so screen H can show sources.
 */
export function briefSections(
  brief: LorBrief,
  meta: BriefMeta,
  audience: "applicant" | "recommender",
): BriefSection[] {
  const forRecommender = audience === "recommender";
  const prose = (text: string) => (forRecommender ? text.replace(CODE_GROUP, "").trim() : text);
  const cites = (codes: readonly Cite[]): Cite[] => (forRecommender ? [] : [...codes]);
  const first = meta.applicant.firstName || meta.applicant.name;
  const sections: BriefSection[] = [
    { kind: "note", heading: `A note from ${first}`, text: prose(brief.cover_note) },
    { kind: "reminder", heading: "How to use this brief", text: OWN_WORDS_REMINDER },
    {
      kind: "explainer",
      heading: "What admissions look for in a letter",
      bullets: LOR_ADMISSIONS_EXPLAINER,
    },
  ];

  for (const school of meta.schools) {
    const written = brief.schools.find((s) => s.school_cycle_id === school.schoolCycleId);
    sections.push({
      kind: "school",
      heading: school.school,
      deadline: school.deadline,
      howToSubmit: school.howToSubmit,
      packNotes: [...school.packNotes],
      questions: school.questions.map((question) => {
        const answer = written?.questions.find((q) => q.question_id === question.id);
        return {
          id: question.id,
          text: question.text,
          limit: question.limit,
          points: (answer?.talking_points ?? []).map((p) => ({
            point: prose(p.point),
            evidence: prose(p.evidence),
            trait: safeTraitLabel(p.trait),
            story: forRecommender ? null : p.story,
            cites: cites(p.cites),
          })),
        };
      }),
    });
  }

  if (brief.traits_to_reinforce.length > 0)
    sections.push({
      kind: "traits",
      heading: "Strengths to bring out",
      items: brief.traits_to_reinforce.map((t) => ({
        trait: safeTraitLabel(t.trait),
        why: prose(t.why),
        cites: cites(t.cites),
      })),
    });

  if (brief.other_recommender_covers.length > 0)
    sections.push({
      kind: "covers",
      heading: "What your other recommender covers",
      items: brief.other_recommender_covers.map(prose),
    });

  const arc = brief.development_arc;
  if (arc)
    sections.push({
      kind: "arc",
      heading: "A piece of feedback, and what changed",
      steps: [
        { label: "The feedback", text: prose(arc.feedback) },
        { label: `How ${first} took it`, text: prose(arc.response) },
        { label: "What they did next", text: prose(arc.steps.join(" ")) },
        { label: "How it shows now", text: prose(arc.evidence) },
      ],
    });

  if (brief.key_facts.length > 0)
    sections.push({
      kind: "facts",
      heading: "Facts to keep consistent",
      items: brief.key_facts.map((f) => ({ text: prose(f.text), cites: cites(f.cites) })),
    });

  const timeline: { date: string; text: string }[] = [];
  if (!forRecommender && meta.askBy)
    timeline.push({ date: meta.askBy, text: `Ask ${meta.recommender.firstName} by this date` });
  for (const date of meta.checkIns) timeline.push({ date, text: `A reminder from ${first}` });
  for (const school of meta.schools)
    if (school.deadline)
      timeline.push({ date: school.deadline, text: `${school.school} deadline` });
  if (timeline.length > 0)
    sections.push({
      kind: "timeline",
      heading: "Timeline",
      items: timeline.sort((a, b) => a.date.localeCompare(b.date)),
    });

  return sections;
}

/* School groups (decision 15) ------------------------------------------------------------------ */

export interface GroupableSchool {
  schoolCycleId: string;
  format: LorFormat;
  /** How many questions the pack publishes. */
  questions: number;
}

/**
 * Every common-form school (the GMAC common format, an unknown format, or a pack with no published
 * questions) shares one brief under COMMON_GROUP_KEY; each school with its own questions gets its
 * own brief keyed by its school_cycle_id. Common first, then the rest in input order.
 */
export function schoolGroups(
  schools: readonly GroupableSchool[],
): { key: string; schoolCycleIds: string[] }[] {
  const common: string[] = [];
  const own: { key: string; schoolCycleIds: string[] }[] = [];
  const seen = new Set<string>();
  for (const school of schools) {
    if (seen.has(school.schoolCycleId)) continue;
    seen.add(school.schoolCycleId);
    if (school.format === "school_specific" && school.questions > 0)
      own.push({ key: school.schoolCycleId, schoolCycleIds: [school.schoolCycleId] });
    else common.push(school.schoolCycleId);
  }
  return [
    ...(common.length > 0 ? [{ key: COMMON_GROUP_KEY, schoolCycleIds: common }] : []),
    ...own,
  ];
}

/* Reminder schedule (decision 18) -------------------------------------------------------------- */

export const REMINDER_KINDS = ["ask", "checkin_3w", "checkin_1w"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_LABELS: Record<ReminderKind, string> = {
  ask: "Invitation",
  checkin_3w: "Three-week check-in",
  checkin_1w: "One-week check-in",
};

/** LOR-02 says ask 6–8 weeks before; 7 is the middle. */
export const ASK_WEEKS_BEFORE = 7;
export const CHECKIN_DAYS_BEFORE = { checkin_3w: 21, checkin_1w: 7 } as const;

export interface PlannedReminder {
  kind: ReminderKind;
  /** ISO date of the deadline it is for (the earliest one for the ask). */
  deadline: string;
  /** ISO date it goes out (09:00 in the applicant's time zone: sendAtFor). */
  sendOn: string;
  schoolCycleIds: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The default schedule for one recommender: the ask 7 weeks before the earliest upcoming deadline
 * (today if that has passed), then a three-week and a one-week check-in before each distinct
 * deadline. A check-in whose date has passed, or that would land on or before the ask, is dropped.
 * Deadlines before today are ignored. Sorted by date, the ask first on a tie.
 */
export function planReminders(input: {
  today: string;
  deadlines: readonly { schoolCycleId: string; date: string }[];
}): PlannedReminder[] {
  const { today } = input;
  const byDate = new Map<string, string[]>();
  for (const { schoolCycleId, date } of input.deadlines) {
    if (!isIsoDate(date) || date < today) continue;
    const ids = byDate.get(date) ?? [];
    if (!ids.includes(schoolCycleId)) ids.push(schoolCycleId);
    byDate.set(date, ids);
  }
  const dates = [...byDate.keys()].sort();
  const earliest = dates[0];
  if (earliest === undefined) return [];

  const proposed = addDays(earliest, -ASK_WEEKS_BEFORE * 7);
  const askOn = proposed < today ? today : proposed;
  const planned: PlannedReminder[] = [
    {
      kind: "ask",
      deadline: earliest,
      sendOn: askOn,
      schoolCycleIds: dates.flatMap((date) => byDate.get(date) ?? []),
    },
  ];
  for (const date of dates)
    for (const kind of ["checkin_3w", "checkin_1w"] as const) {
      const sendOn = addDays(date, -CHECKIN_DAYS_BEFORE[kind]);
      if (sendOn < today || sendOn <= askOn) continue;
      planned.push({ kind, deadline: date, sendOn, schoolCycleIds: [...(byDate.get(date) ?? [])] });
    }
  const order = (kind: ReminderKind) => REMINDER_KINDS.indexOf(kind);
  return planned.sort(
    (a, b) =>
      a.sendOn.localeCompare(b.sendOn) ||
      order(a.kind) - order(b.kind) ||
      a.deadline.localeCompare(b.deadline),
  );
}

/** The hour reminders go out, in the applicant's time zone. */
export const REMINDER_HOUR = 9;

/** Milliseconds the zone is ahead of UTC at `instant` (negative west of Greenwich). */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * 09:00 on `sendOn` in the IANA zone `timeZone`, as an instant. DST-safe: the offset is taken at
 * the result, not at midnight. A null or unknown zone falls back to 09:00 UTC.
 */
export function sendAtFor(sendOn: string, timeZone: string | null): Date {
  const date = isIsoDate(sendOn) ? sendOn : new Date().toISOString().slice(0, 10);
  const wall = Date.parse(`${date}T${String(REMINDER_HOUR).padStart(2, "0")}:00:00Z`);
  if (!timeZone) return new Date(wall);
  try {
    let guess = wall - zoneOffset(wall, timeZone);
    // A second pass settles a guess that crossed a DST change.
    const settled = wall - zoneOffset(guess, timeZone);
    if (settled !== guess) guess = settled;
    return new Date(guess);
  } catch {
    return new Date(wall);
  }
}

/* Invite links (decision 10, §14.6) ------------------------------------------------------------ */

export const INVITE_GRACE_DAYS = 14;
export const INVITE_MAX_DAYS = 180;
export const INVITE_DEFAULT_DAYS = 30;

/**
 * When a portal link stops working: 14 days after the latest deadline among the recommender's
 * schools, never sooner than 14 days after issue and never later than 180 days after it. With no
 * known deadline, 30 days after issue.
 */
export function inviteExpiry(issuedAt: Date, deadlines: readonly string[]): Date {
  const issued = issuedAt.getTime();
  const latest = deadlines
    .filter(isIsoDate)
    .map((date) => Date.parse(`${date}T00:00:00Z`))
    .reduce<number | null>((max, time) => (max === null || time > max ? time : max), null);
  if (latest === null) return new Date(issued + INVITE_DEFAULT_DAYS * DAY_MS);
  const grace = Math.max(latest + INVITE_GRACE_DAYS * DAY_MS, issued + INVITE_GRACE_DAYS * DAY_MS);
  return new Date(Math.min(issued + INVITE_MAX_DAYS * DAY_MS, grace));
}

/* Status (what the applicant may see, §14.3) --------------------------------------------------- */

export const RECOMMENDER_STATUSES = [
  "not_invited",
  "invited",
  "opened",
  "in_progress",
  "submitted",
] as const;
export type RecommenderStatus = (typeof RECOMMENDER_STATUSES)[number];

export const RECOMMENDER_STATUS_LABELS: Record<RecommenderStatus, string> = {
  not_invited: "Not invited yet",
  invited: "Invited",
  opened: "Opened",
  in_progress: "In progress",
  submitted: "Marked submitted",
};

/**
 * The furthest step the facts support: submitted (every school marked) › in progress (writing, or
 * some schools marked) › opened › invited (a live or expired link was sent) › not invited.
 */
export function recommenderStatusOf(s: {
  invite: { status: string; sentAt: string } | null;
  openedAt: string | null;
  progressAt: string | null;
  submitted: Record<string, string>;
  schoolCycleIds: readonly string[];
}): RecommenderStatus {
  const marked = s.schoolCycleIds.filter((id) => Boolean(s.submitted[id]));
  if (s.schoolCycleIds.length > 0 && marked.length === s.schoolCycleIds.length) return "submitted";
  if (s.progressAt || marked.length > 0) return "in_progress";
  if (s.openedAt) return "opened";
  if (s.invite && s.invite.status !== "revoked") return "invited";
  return "not_invited";
}

/* Portal (decisions 20 and 21) ----------------------------------------------------------------- */

export const PORTAL_MODES = ["assist", "coach"] as const;
export type PortalMode = (typeof PORTAL_MODES)[number];

/** Stances under which a school's rule on recommenders' AI use means coach mode. */
const RESTRICTIVE_STANCES = new Set(["limited", "prohibited"]);

/**
 * Coach when any school in the group restricts AI use for recommendations (strictest wins);
 * otherwise assist. The recommender can always choose coach for themselves.
 */
export function recommenderModeFor(
  policies: readonly { stance: string; applies_to: readonly string[] }[],
): PortalMode {
  return policies.some(
    (p) => RESTRICTIVE_STANCES.has(p.stance) && p.applies_to.includes("recommendations"),
  )
    ? "coach"
    : "assist";
}

export const PORTAL_LIMITS = {
  assistsPerHour: 10,
  assistsTotal: 40,
  sttPerMinute: 10,
  voiceSeconds: 3600,
  notesMax: 200,
  noteChars: 8000,
  letterChars: 12000,
} as const;

export interface PortalNote {
  /** "n1", "n2"… */
  id: string;
  text: string;
  /** ISO time. */
  at: string;
  /** Set for a dictated note; no audio is ever kept (decision 5). */
  spoken: { seconds: number; language: string } | null;
}

export interface AssistSentence {
  text: string;
  /** "verbatim": the recommender's own words; "adapted": their words reordered or joined. */
  kind: "verbatim" | "adapted";
  /** The note ids (N1…) it comes from. */
  notes: string[];
}

/** `lor.recommender_assist` output. Coach mode: `answer` is null and only the outline is given. */
export interface RecommenderAssist {
  answer: { paragraphs: { sentences: AssistSentence[] }[] } | null;
  outline: { beat: string; your_notes: string[]; questions: string[] }[];
  missing: string[];
}

export interface PortalLetter {
  text: string;
  assisted: RecommenderAssist | null;
  mode: PortalMode | null;
  /** ISO time. */
  updatedAt: string;
}

/** The recommender's own voice, measured from their notes (packages/linters `recommenderVoice`). */
export interface RecommenderVoice {
  sentences: number;
  meanWords: number;
  cv: number;
  contractions: number;
  firstPerson: number;
  register: "plain" | "formal";
  opener: "time" | "person" | "other";
  /** One line for the assistant ("short plain sentences, first person, contractions"). */
  card: string;
}

/** The key a letter is stored under in the workspace: one per group and question. */
export const letterKey = (groupKey: string, questionId: string): string =>
  `${groupKey}/${questionId}`;
