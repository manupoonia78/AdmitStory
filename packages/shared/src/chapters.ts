// The nine Story Studio chapters (spec §5.2). The applicant can jump between them at any time;
// the slot selector prefers slots belonging to the chapter they are in.

export const CHAPTER_IDS = [
  "roots",
  "education",
  "work",
  "beyond_work",
  "turning_points",
  "people_and_values",
  "goals",
  "schools",
  "recommenders",
] as const;

export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Chapter {
  id: ChapterId;
  /** Tab label (spec §6.10 screen B). */
  label: string;
  /** One line of what the chapter gathers, from the §5.2 table. Shown on the chapter's first turn. */
  gathers: string;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: "roots",
    label: "Roots",
    gathers:
      "Where you grew up, family, the environment that formed you, early responsibilities, languages, moves.",
  },
  {
    id: "education",
    label: "Education",
    gathers:
      "Why your field, your academic record, standout moments, leadership in college, research and projects.",
  },
  {
    id: "work",
    label: "Work",
    gathers:
      "Each role: why you took it, your scope and team, what you are proudest of, the numbers, promotions, feedback.",
  },
  {
    id: "beyond_work",
    label: "Beyond work",
    gathers:
      "Community, volunteering, sport, creative work, things you built or started, hobbies with real depth.",
  },
  {
    id: "turning_points",
    label: "Turning points",
    gathers:
      "Failures, setbacks, hard feedback, ethical dilemmas, people you supported, moments that changed how you think.",
  },
  {
    id: "people_and_values",
    label: "People and values",
    gathers:
      "Role models, who shaped you, what you would lose a job over, how others describe you, your quirks.",
  },
  {
    id: "goals",
    label: "Goals",
    gathers:
      "Your short-term role, long-term vision, why, how you have tested it, your Plan B, why an MBA and why now.",
  },
  {
    id: "schools",
    label: "Schools",
    gathers:
      "Schools you are considering and why, visits, people you have spoken to, the clubs and courses that matter.",
  },
  {
    id: "recommenders",
    label: "Recommenders",
    gathers: "Who could write for you, your relationship, and the stories each of them could tell.",
  },
] as const;

const BY_ID = new Map(CHAPTERS.map((entry) => [entry.id, entry] as const));

export function chapter(id: ChapterId): Chapter {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown chapter: ${id}`);
  return found;
}

export function isChapterId(value: string): value is ChapterId {
  return BY_ID.has(value as ChapterId);
}

export const FIRST_CHAPTER: ChapterId = "roots";

/** The chapter after this one, or undefined at the end of the interview. */
export function nextChapter(id: ChapterId): ChapterId | undefined {
  return CHAPTER_IDS[CHAPTER_IDS.indexOf(id) + 1];
}
