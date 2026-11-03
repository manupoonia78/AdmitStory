// The scripted kit run for the Phase 0.5 assembly prototype (spec §6.7, §16). Fake data: a
// fictional applicant (a hospital systems analyst) and a fictional school with invented prompts.
// kitStateAt() is pure, so the whole ~40 second run is unit-tested and can be scrubbed (?at=ms).

import type { KitDeliverable, KitStage, KitStory } from "@admitstory/ui";

export const KIT_DURATION_MS = 40_000;

export const SCHOOL = {
  name: "Northfield School of Management",
  short: "Northfield",
  cycle: "2026–27",
} as const;

export const STORIES: readonly KitStory[] = [
  { id: "S03", title: "The night-shift fix", context: "Work, 2024" },
  { id: "S07", title: "Eight people in a park", context: "Community, 2021" },
  { id: "S09", title: "The vendor who said no", context: "Work, 2023" },
  { id: "S11", title: "My grandmother’s ledger", context: "Home, 2006" },
  { id: "S05", title: "The warning on my record", context: "Work, 2019" },
];

interface ScriptedDeliverable {
  key: string;
  title: string;
  prompt: string;
  limit: string;
  storyId: string;
  opening: string;
  /** When the file map gives it its story. */
  mapAt: number;
  draftFrom: number;
  draftTo: number;
}

const DELIVERABLES: readonly ScriptedDeliverable[] = [
  {
    key: "essay-1",
    title: "Essay 1",
    prompt:
      "Tell us about a time you took responsibility for something that was not yours to fix. What changed because of you?",
    limit: "200 words",
    storyId: "S03",
    opening:
      "It was 2 a.m. and the feed from the lab system was dropping every fourth message. Nobody on the ward could see it yet, but I could. The go-live had been planned for months, and the manager who owned it had left two weeks before.",
    mapAt: 6_000,
    draftFrom: 11_500,
    draftTo: 19_500,
  },
  {
    key: "essay-2",
    title: "Essay 2",
    prompt: "Describe a community you helped build. What did it ask of you?",
    limit: "300 words",
    storyId: "S07",
    opening:
      "The first Saturday, eight people came to the park, and three of them were my cousins. By spring there were forty, and I had stopped counting. What kept them coming back was never the football.",
    mapAt: 7_200,
    draftFrom: 15_000,
    draftTo: 24_000,
  },
  {
    key: "essay-3",
    title: "Essay 3",
    prompt: "Why Northfield, and why now?",
    limit: "250 words",
    storyId: "S09",
    opening:
      "Last year a vendor told me our hospital was too small to matter. I spent six weeks proving him wrong. I want the next two years to teach me how to do it in six days.",
    mapAt: 8_400,
    draftFrom: 19_500,
    draftTo: 29_000,
  },
  {
    key: "short-1",
    title: "Short answer",
    prompt: "What would your colleagues be surprised to learn about you?",
    limit: "50 words",
    storyId: "S11",
    opening:
      "I learned to keep accounts from my grandmother’s ledger before I could do long division. She wrote every sale in pencil, so mistakes could be fixed without being hidden.",
    mapAt: 9_600,
    draftFrom: 26_000,
    draftTo: 30_500,
  },
  {
    key: "goal",
    title: "Goal statement",
    prompt: "Your goal after Northfield, in one sentence.",
    limit: "150 characters",
    storyId: "S03",
    opening:
      "Lead clinical operations for a regional hospital network, so night shifts run on systems instead of heroes.",
    mapAt: 10_800,
    draftFrom: 29_500,
    draftTo: 33_000,
  },
];

export const GAP_QUESTIONS: readonly string[] = [
  "What did your manager say when you told him about the fix?",
  "Roughly how many lab messages were lost before you found the timeout?",
  "How many people come to the park on a Saturday now?",
  "Which part of Northfield’s programme have you looked into most closely?",
];

const POSITIONING_DONE = 5_000;
const FILE_MAP_DONE = 11_500;
const GAPS_FOUND = 12_000;
const SHORT_FROM = 26_000;
const SHORT_DONE = 33_000;
const REST_FROM = 33_000;
const REST_DONE = 39_000;
/** Each opening has fully arrived this long before its draft is marked ready. */
const OPENING_LEAD_MS = 1_200;

const ESSAYS = DELIVERABLES.filter((d) => d.key.startsWith("essay"));
const ESSAYS_DONE = Math.max(...ESSAYS.map((d) => d.draftTo));

export interface KitScriptState {
  stages: KitStage[];
  deliverables: KitDeliverable[];
  /** Gap questions found, or null while the gap check runs. */
  gapCount: number | null;
  done: boolean;
}

const storyTitle = (id: string) => STORIES.find((s) => s.id === id)?.title ?? "";
/** "The night-shift fix" → "the night-shift fix", for use mid-sentence. */
const midSentence = (title: string) => title.charAt(0).toLowerCase() + title.slice(1);

/** How much of `text` has streamed by `ms`, cut at a character boundary. */
export function revealed(text: string, ms: number, from: number, to: number): string {
  const end = to - OPENING_LEAD_MS;
  if (ms <= from) return "";
  if (ms >= end) return text;
  return text.slice(0, Math.floor((text.length * (ms - from)) / (end - from)));
}

function stage(
  id: string,
  label: string,
  ms: number,
  from: number,
  to: number,
  detail: { active: string; done?: string; actionLabel?: string },
): KitStage {
  const status = ms >= to ? "done" : ms >= from ? "active" : "waiting";
  return {
    id,
    label,
    status,
    ...(status === "active" ? { detail: detail.active } : {}),
    ...(status === "done" && detail.done ? { detail: detail.done } : {}),
    ...(status === "done" && detail.actionLabel ? { actionLabel: detail.actionLabel } : {}),
  };
}

/** The whole kit at `ms` milliseconds into the run. */
export function kitStateAt(ms: number): KitScriptState {
  const deliverables: KitDeliverable[] = DELIVERABLES.map((d) => {
    const status =
      ms >= d.draftTo
        ? "ready"
        : ms >= d.draftFrom
          ? "drafting"
          : ms >= d.mapAt
            ? "mapped"
            : "waiting";
    return {
      key: d.key,
      title: d.title,
      prompt: d.prompt,
      limit: d.limit,
      status,
      storyId: status === "waiting" ? null : d.storyId,
      text: revealed(d.opening, ms, d.draftFrom, d.draftTo),
      reserve: d.opening,
    };
  });

  // The essay most recently started names the essays stage (screen F, spec §6.9 "Kit running").
  const drafting = ESSAYS.filter((d) => ms >= d.draftFrom && ms < d.draftTo).at(-1);
  const essaysDetail = drafting
    ? `Drafting ${drafting.title} from your story about ${midSentence(storyTitle(drafting.storyId))}`
    : "Waiting for the next essay";

  const stages: KitStage[] = [
    stage("positioning", "Positioning", ms, 0, POSITIONING_DONE, {
      active: `Reading your stories against what ${SCHOOL.short} looks for`,
      actionLabel: "Read it now",
    }),
    stage("file-map", "File map", ms, POSITIONING_DONE, FILE_MAP_DONE, {
      active: "Choosing the story that leads each essay",
      actionLabel: "Read it now",
    }),
    stage("essays", "Essays", ms, FILE_MAP_DONE, ESSAYS_DONE, {
      active: essaysDetail,
      done: `${ESSAYS.length} drafts ready`,
    }),
    stage("short-answers", "Short answers", ms, SHORT_FROM, SHORT_DONE, {
      active: "Writing a short answer and your goal statement",
      done: "2 drafts ready",
    }),
    stage("rest", "Form advisor, resume, recommenders, interview plan", ms, REST_FROM, REST_DONE, {
      active: "Preparing form advice, recommender briefs and an interview plan",
      done: "Ready to review",
    }),
  ];

  return {
    stages,
    deliverables,
    gapCount: ms >= GAPS_FOUND ? GAP_QUESTIONS.length : null,
    done: ms >= REST_DONE,
  };
}

/** Which story leads each deliverable, for the file map summary. */
export function fileMapSummary(): { title: string; story: string }[] {
  return DELIVERABLES.map((d) => ({ title: d.title, story: storyTitle(d.storyId) }));
}

export const POSITIONING_POINTS: readonly string[] = [
  `${SCHOOL.short} needs to see that you take ownership without waiting for a title. The night-shift fix shows it best, so it leads Essay 1.`,
  "Lead with two traits: calm under pressure, and building things that last after you leave.",
  "Address the warning on your record in the optional essay, briefly and with what changed after it.",
  "Your goal fits the school’s health operations recruiting. Keep a second route ready in hospital technology.",
];
