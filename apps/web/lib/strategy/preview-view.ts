// The kit preview as the page shows it (spec §5.5): the positioning headline, the file map with
// titles only, and the deliverables present but locked. Pure, so the preview route and the tests
// build it the same way. The only draft text a preview carries is the opening of one essay, built
// from the applicant's own story (Manu, 16 Nov 2026); every other draft stays locked.

import type { SchoolPack } from "@admitstory/kb/types";
import { traitLabel } from "@admitstory/shared";
import type { FileMap, Positioning } from "@admitstory/shared/kit";
import { COMING_SOON } from "@/lib/deferred/coming-soon";
import type { PackDeliverable } from "./deliverables";
import { firstCitation, shortDate, type RetrievalSource } from "./pack";
import type { PreviewOpeningView, PreviewView } from "./types";

export interface StoryTitle {
  code: string;
  nickname: string;
}

/** "Lead with how you bring people along and your commercial judgment at Halvorsen." */
export function positioningHeadline(positioning: Positioning, schoolName: string): string {
  const traits = positioning.lead_traits.map((t) => traitLabel(t.trait).toLowerCase());
  if (traits.length === 0) return `Your file for ${schoolName}, planned story by story.`;
  const list =
    traits.length === 1
      ? traits[0]
      : `${traits.slice(0, -1).join(", ")} and ${traits.at(-1) ?? ""}`;
  return `At ${schoolName}, lead with ${list}.`;
}

/** The opening as the preview run stored it beside the file map (lib/strategy/jobs.ts). */
export interface StoredOpening {
  deliverable_key: string;
  story: string;
  text: string;
}

/** Reads the stored opening defensively: it is JSON from an earlier run, so nothing is assumed. */
export function readStoredOpening(value: unknown): StoredOpening | null {
  if (value === null || typeof value !== "object") return null;
  const { deliverable_key: key, story, text } = value as Record<string, unknown>;
  if (typeof key !== "string" || typeof story !== "string" || typeof text !== "string") return null;
  return text.trim() === "" ? null : { deliverable_key: key, story, text: text.trim() };
}

/**
 * The opening for the page, or null: it shows only for an essay the school still asks for and a
 * story the applicant still has, so a deleted story or a changed pack never leaves stale text up.
 */
export function openingView(
  opening: StoredOpening | null,
  deliverables: readonly PackDeliverable[],
  stories: readonly StoryTitle[],
): PreviewOpeningView | null {
  if (!opening) return null;
  const deliverable = deliverables.find((d) => d.key === opening.deliverable_key && d.drafted);
  const story = stories.find((s) => s.code === opening.story);
  if (!deliverable || !story) return null;
  return {
    essay: deliverable.title,
    limit: deliverable.limit ?? null,
    prompt: deliverable.prompt,
    story: story.nickname,
    text: opening.text,
  };
}

export function previewView(input: {
  schoolName: string;
  pack: SchoolPack;
  positioning: Positioning;
  fileMap: FileMap;
  deliverables: readonly PackDeliverable[];
  stories: readonly StoryTitle[];
  retrieval?: readonly RetrievalSource[];
  /** The essay opening stored with the preview, and whether the school's policy ruled one out. */
  opening?: StoredOpening | null;
  coached?: boolean;
  builtAt: Date;
}): PreviewView {
  const titleOf = (code: string | null) =>
    code ? (input.stories.find((s) => s.code === code)?.nickname ?? null) : null;
  const storyFor = (key: string) =>
    titleOf(
      input.fileMap.items.find((item) => item.deliverable_key === key)?.primary_story ?? null,
    );

  // What the school must see is a school claim: each line shows only with a source we can name.
  const support = input.positioning.must_see
    .map((line) => {
      const citation = firstCitation(input.pack, line.cites, input.retrieval ?? []);
      return citation
        ? `${line.text} (${citation.source}, verified ${shortDate(citation.verifiedOn ?? "")})`
        : null;
    })
    .filter((line): line is string => line !== null)
    .slice(0, 3);

  return {
    headline: positioningHeadline(input.positioning, input.schoolName),
    support,
    opening: input.coached
      ? null
      : openingView(input.opening ?? null, input.deliverables, input.stories),
    coached: input.coached === true,
    fileMap: input.deliverables.map((d) => ({
      key: d.key,
      // Interview practice is deferred (Phase 7), so its rows say so rather than promise a draft.
      deliverable: d.kind === "interview_question" ? `${d.title} (${COMING_SOON})` : d.title,
      story: storyFor(d.key),
    })),
    deliverables: input.deliverables
      .filter((d) => d.drafted)
      .map((d) => ({
        key: d.key,
        title: d.title,
        limit: d.limit ?? "No limit",
        story: storyFor(d.key),
      })),
    builtAt: input.builtAt.toISOString(),
  };
}
