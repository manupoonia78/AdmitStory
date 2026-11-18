// The kit pipeline's first agent (spec §8.5.5): the Strategist plans the whole file for one school
// from the full compiled pack (L1) and the full compact dossier (L2). Its hard rules are checked
// in code after parsing (fileMapIssues, positioningIssues), so a violation gets the same single
// repair attempt as a schema failure instead of reaching the workspace.

import {
  citableCodes,
  dossierBrandTraits,
  dossierStoryCodes,
  fileMapIssues,
  positioningIssues,
  unresolvedCites,
} from "@admitstory/shared/kit";
import type { z } from "zod";
import { retrievalBlocks } from "../request";
import { KitPositioningInput, KitPositioningOutput } from "../schemas";
import { defineTask } from "./define";

/** Kinds whose opening the free preview may show: the long, written answers. */
const OPENING_KINDS: ReadonlySet<string> = new Set(["essay", "reapplicant_essay"]);

/**
 * The preview's essay opening (prompt v2): none unless it was asked for, and when given it must
 * open an essay the request listed, from the story the file map gives that essay.
 */
function openingIssues(
  output: z.output<typeof KitPositioningOutput>,
  input: z.output<typeof KitPositioningInput>,
): { path: string; message: string }[] {
  const { opening } = output;
  if (!opening) return [];
  if (!input.draft_opening)
    return [{ path: "opening", message: 'The request says "Opening: none"; return null' }];
  const deliverable = input.deliverables.find((d) => d.key === opening.deliverable_key);
  if (!deliverable || !OPENING_KINDS.has(deliverable.kind))
    return [
      {
        path: "opening.deliverable_key",
        message: `"${opening.deliverable_key}" is not an essay listed in the request`,
      },
    ];
  const planned = output.file_map.items.find((i) => i.deliverable_key === opening.deliverable_key);
  if (planned?.primary_story !== opening.story)
    return [
      {
        path: "opening.story",
        message: `Open with the essay's own primary story (${planned?.primary_story ?? "it has none: choose another essay or return null"})`,
      },
    ];
  return [];
}

export const kitPositioningFilemap = defineTask({
  name: "kit.positioning_filemap",
  agent: "kit.positioning_filemap",
  // With $defs the schema is over the API's grammar cap since the preview opening (v2) was added,
  // and every call was refused with a 400; written out in place it fits (checked 2026-11-18).
  schemaRefs: "inline",
  input: KitPositioningInput,
  output: KitPositioningOutput,
  outputName: "KitPositioningOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => {
    const deliverables = input.deliverables
      .map(
        (d) =>
          `${d.key} | ${d.kind} | ${d.required ? "required" : "optional"} | limit: ${d.limit ?? "none"}\n  prompt: ${JSON.stringify(d.prompt)}`,
      )
      .join("\n");
    const recommenders =
      input.recommenders.length === 0
        ? "Recommenders: none named yet. Return an empty recommender_plan and say so in warnings."
        : [
            "Recommenders:",
            ...input.recommenders.map((r) => `${r.id} | ${r.role} | ${r.relationship}`),
          ].join("\n");
    return [
      {
        role: "user",
        content: [
          `School: ${input.school} (${input.cycle}). Its compiled pack and the applicant's dossier are above.`,
          `Reapplicant to this school: ${input.is_reapplicant ? "yes" : "no"}`,
          `Deliverables (map every one, by key, exactly once):\n${deliverables}`,
          recommenders,
          retrievalBlocks(input.retrieval),
          input.draft_opening
            ? "Opening: write. Produce the positioning, the file map and the opening."
            : "Opening: none. Produce the positioning and the file map.",
        ].join("\n\n"),
      },
    ];
  },
  check: (output, input, layers) => {
    const dossier = layers.dossier ?? "";
    const known = citableCodes({
      dossier,
      schoolPack: layers.schoolPack,
      retrievalIds: input.retrieval.map((chunk) => chunk.id),
    });
    return [
      ...positioningIssues(output.positioning, {
        isReapplicant: input.is_reapplicant,
        brandTraits: dossierBrandTraits(dossier),
      }),
      ...fileMapIssues(output.file_map, {
        storyCodes: dossierStoryCodes(dossier),
        deliverableKeys: input.deliverables.map((d) => d.key),
        recommenderIds: input.recommenders.map((r) => r.id),
      }),
      ...unresolvedCites(output, known),
      ...openingIssues(output, input),
    ];
  },
});
