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
import { retrievalBlocks } from "../request";
import { KitPositioningInput, KitPositioningOutput } from "../schemas";
import { defineTask } from "./define";

export const kitPositioningFilemap = defineTask({
  name: "kit.positioning_filemap",
  agent: "kit.positioning_filemap",
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
          "Produce the positioning and the file map.",
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
    ];
  },
});
