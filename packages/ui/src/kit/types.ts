// What the kit assembly shows (spec §5.7 pipeline, §6.10 screen F). Plain data, so the Phase 0.5
// prototype can drive it from a script and Phase 4 from the pipeline's streamed stage outputs.

export type KitStageStatus = "waiting" | "active" | "done";

export interface KitStage {
  id: string;
  /** "Positioning", "File map", "Essays"… */
  label: string;
  status: KitStageStatus;
  /** One line of progress, e.g. "Drafting Essay 2 from your story about the night-shift fix". */
  detail?: string;
  /** Offered once done, e.g. "Read it now" (screen F). */
  actionLabel?: string;
}

export interface KitStory {
  /** Story id, "S03". */
  id: string;
  title: string;
  /** Where it sits in the applicant's life, e.g. "Work, 2024". */
  context?: string;
}

/**
 * "waiting": no story chosen yet. "mapped": the file map gave it a story. "drafting": its first
 * lines are streaming. "ready": drafted. "failed": drafting stopped; the others carry on.
 */
export type KitDeliverableStatus = "waiting" | "mapped" | "drafting" | "ready" | "failed";

export interface KitDeliverable {
  key: string;
  /** "Essay 1", "Short answer". */
  title: string;
  /** The school's prompt, verbatim. */
  prompt: string;
  /** "250 words", "150 characters". */
  limit: string;
  status: KitDeliverableStatus;
  /** The primary story (spec Appendix I FileMapItem.primary_story), once decided. */
  storyId: string | null;
  /** The draft's opening as streamed so far. */
  text: string;
  /**
   * Space held for the opening so rows never move as it arrives: the expected text, or a number
   * of lines (default 3).
   */
  reserve?: string | number;
}
