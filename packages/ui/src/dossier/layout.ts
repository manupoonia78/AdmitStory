// The order of a life's eras (SPEC §6.11): the Dossier's timeline puts each era in a column, in
// time. Dated eras by their first year; undated ones by what they mean (childhood, then
// education, then anything unlabelled, which is usually recent work the applicant didn't date).
//
// Pure and deterministic: the same stories always produce the same columns, so nothing jumps when
// the view re-renders, and the order can be computed on the server for the first paint.

export interface TimelineStory {
  id: string;
  /** "2024", "2019–2021", "college", "before college". */
  era: string;
}

/** The first year in an era string, or undefined for "college" and the like. */
function yearOf(era: string): number | undefined {
  const match = era.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

/**
 * Eras without a year are placed by what they mean rather than dropped: childhood first, then
 * education, then anything unlabelled, which sorts after dated material because an undated story is
 * usually recent work the applicant did not date.
 */
const UNDATED_ORDER: { pattern: RegExp; rank: number }[] = [
  { pattern: /child|school|home|grew up|before college/i, rank: -3 },
  { pattern: /college|university|undergrad|degree|mba/i, rank: -2 },
];

function undatedRank(era: string): number {
  return UNDATED_ORDER.find((entry) => entry.pattern.test(era))?.rank ?? -1;
}

/** The distinct eras of these stories, earliest first; an empty era is "Undated". */
export function orderEras(stories: readonly TimelineStory[]): string[] {
  const keys = [...new Set(stories.map((story) => story.era.trim() || UNDATED))];
  return keys.sort((a, b) => {
    const yearA = yearOf(a);
    const yearB = yearOf(b);
    if (yearA !== undefined && yearB !== undefined) return yearA - yearB || a.localeCompare(b);
    if (yearA !== undefined) return 1;
    if (yearB !== undefined) return -1;
    return undatedRank(a) - undatedRank(b) || a.localeCompare(b);
  });
}

/** The label used for stories with no era. */
export const UNDATED = "Undated";
