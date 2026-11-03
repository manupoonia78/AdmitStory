import type { CoverageLensId, StoryCardData } from "@admitstory/ui";
import type { CoverageId, CoverageLevel } from "@admitstory/shared";
import type { StudioSummary } from "@/lib/studio/summary";

// What the Studio's routes hand the client. Kept apart from the components so the server page and
// the client screen agree on one shape.

export interface QuestionDto {
  question: string;
  move: "DIG" | "NEXT" | "CONFIRM" | "CARE";
  slot: string;
  storyRef: string | null;
  turnId: string;
  chapter:
    | "roots"
    | "education"
    | "work"
    | "beyond_work"
    | "turning_points"
    | "people_and_values"
    | "goals"
    | "schools"
    | "recommenders";
  latencyMs: number;
}

export interface CoverageBarDto {
  id: CoverageId;
  level: CoverageLevel;
  note?: string;
}

export type SummaryDto = StudioSummary;

/**
 * The coverage meter's own ids are hyphenated (packages/ui), while the lens ids in model schemas
 * and the database use underscores (Appendix I). One map, here, so the two never drift silently.
 */
export const COVERAGE_UI_ID: Record<CoverageId, CoverageLensId> = {
  academics: "academics",
  self_awareness: "self-awareness",
  employability: "employability",
  leadership: "leadership",
  goals: "goals",
  school_fit: "school-fit",
};

/** A story row as the shelf wants it. Status becomes a label, never a bare enum (spec §6.3). */
const STORY_STATUS_LABELS = {
  confirmed: { tone: "verified" as const, label: "Confirmed" },
  partial: { tone: "needs" as const, label: "Needs a detail" },
  unconfirmed: { tone: "neutral" as const, label: "Just mentioned" },
};

export interface ShelfStory {
  id: string;
  nickname: string;
  era: string;
  context: string;
  traits: readonly string[];
  status: "confirmed" | "partial" | "unconfirmed";
}

export function toCard(story: ShelfStory): StoryCardData {
  return {
    id: story.id,
    nickname: story.nickname,
    era: story.era,
    context: story.context,
    traits: story.traits,
    status: STORY_STATUS_LABELS[story.status],
  };
}
