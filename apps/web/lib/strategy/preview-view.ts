// The kit preview as the page shows it (spec §5.5): the positioning headline, the file map with
// titles only, and the deliverables present but locked. Pure, so the preview route and the tests
// build it the same way. Nothing here ever exposes draft text: a preview has none.

import type { SchoolPack } from "@admitstory/kb/types";
import { traitLabel } from "@admitstory/shared";
import type { FileMap, Positioning } from "@admitstory/shared/kit";
import type { PackDeliverable } from "./deliverables";
import { firstCitation, shortDate, type RetrievalSource } from "./pack";
import type { PreviewView } from "./types";

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

export function previewView(input: {
  schoolName: string;
  pack: SchoolPack;
  positioning: Positioning;
  fileMap: FileMap;
  deliverables: readonly PackDeliverable[];
  stories: readonly StoryTitle[];
  retrieval?: readonly RetrievalSource[];
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
    fileMap: input.deliverables.map((d) => ({
      key: d.key,
      deliverable: d.title,
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
