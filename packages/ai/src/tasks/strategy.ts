// The free tier's reads (spec §5.4, §5.5): Profile Read and the per-school fit. Both are
// evidence-only: every claim cites the material it rests on, and neither ever states odds.
// Median comparisons arrive pre-computed (compareToMedian in @admitstory/shared/kit).

import {
  citableCodes,
  oddsLanguage,
  unresolvedCites,
  type MedianComparison,
} from "@admitstory/shared/kit";
import { retrievalBlocks, untrustedBlock } from "../request";
import { ProfileReadInput, ProfileReadOutput, SchoolFitInput, SchoolFitOutput } from "../schemas";
import { defineTask } from "./define";

const LABEL: Record<MedianComparison["test"], string> = {
  above: "above the median",
  near: "near the median",
  below: "below the median",
  unknown: "not comparable",
};

function medianLine(medians: MedianComparison): string {
  return [
    `test ${LABEL[medians.test]}`,
    `GPA ${LABEL[medians.gpa]}`,
    `years of experience ${LABEL[medians.years_experience]}`,
  ].join(" | ");
}

export const profileRead = defineTask({
  name: "profile.read",
  agent: "profile.read",
  input: ProfileReadInput,
  output: ProfileReadOutput,
  outputName: "ProfileRead",
  requires: ["dossier"],
  buildMessages: (input) => {
    const targets =
      input.targets.length === 0
        ? "Target schools: none chosen yet. Judge against the applicant's own goals, not a school."
        : [
            "Target schools, with the applicant's numbers against each class profile (computed in code: use as given, never as odds):",
            ...input.targets.map((t) => `  ${t.school}: ${medianLine(t.medians)}`),
          ].join("\n");
    return [
      {
        role: "user",
        content: [
          targets,
          "Write the Profile Read for the applicant in the dossier: the four lenses, the strengthening plan and the brand preview.",
        ].join("\n\n"),
      },
    ];
  },
  check: (output, _input, layers) => [
    // Profile Read cites the applicant's own material only: facts, stories, golden lines.
    ...unresolvedCites(output, citableCodes({ dossier: layers.dossier }), [
      "fact",
      "story",
      "line",
    ]),
    ...oddsLanguage(output),
  ],
});

export const schoolFit = defineTask({
  name: "strategy.school_fit",
  agent: "strategy.school_fit",
  input: SchoolFitInput,
  output: SchoolFitOutput,
  outputName: "SchoolFit",
  requires: ["schoolPack"],
  buildMessages: (input) => {
    const { applicant } = input;
    const facts = [
      `School: ${input.school} (${input.cycle}). Its published pack is above; cite its items by K code.`,
      `Target function: ${applicant.target_function ?? "not stated"}`,
      `Brand traits: ${applicant.brand_traits.length > 0 ? applicant.brand_traits.join(", ") : "none yet"}`,
      `International applicant: ${applicant.international === null ? "unknown" : applicant.international ? "yes" : "no"}`,
      `Round considered: ${applicant.round ?? "not chosen"}`,
      `Against this school's class profile (computed in code: use as given, never as odds): ${medianLine(input.medians)}`,
    ].join("\n");
    return [
      {
        role: "user",
        content: [
          facts,
          untrustedBlock("applicant_summary", applicant.summary),
          retrievalBlocks(input.retrieval),
          "Write the honest flags, what this school looks for against the applicant's traits, and the outcomes in their target function.",
        ].join("\n\n"),
      },
    ];
  },
  check: (output, input, layers) => {
    // School Fit cites the school only: the compiled pack's K codes and the retrieved chunks'.
    const known = citableCodes({
      schoolPack: layers.schoolPack,
      retrievalIds: input.retrieval.map((chunk) => chunk.id),
    });
    const brand = new Set<string>(input.applicant.brand_traits);
    return [
      ...unresolvedCites(output, known, ["pack"]),
      ...(input.applicant.target_function === null && output.outcome_in_target_function !== null
        ? [
            {
              path: "outcome_in_target_function",
              message: "Must be null: the applicant has not named a target function",
            },
          ]
        : []),
      ...output.looks_for.flatMap((item, index) =>
        item.your_traits
          .filter((trait) => !brand.has(trait))
          .map((trait) => ({
            path: `looks_for.${index}.your_traits`,
            message: `${trait} is not one of the applicant's brand traits`,
          })),
      ),
      ...oddsLanguage(output),
    ];
  },
});
