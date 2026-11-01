// The knowledge-base agents (spec §8.5.17, §9.3): the Normalizer proposes field-level pack
// updates from one source; the Refresh Checker says whether an official page changed in a way an
// applicant relies on. Both read untrusted text (a PDF, a web page), always inside delimited
// blocks (§14.6), and both feed the admin review screen, never a user directly.

import type { ValidationIssue } from "../errors";
import { untrustedBlock } from "../request";
import {
  KbNormalizeInput,
  KbNormalizeOutput,
  KbRefreshCheckInput,
  KbRefreshCheckOutput,
  VERBATIM_RUN_WORDS,
} from "../schemas";
import { defineTask } from "./define";

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * The first run of `n` consecutive words that `candidate` shares with `source`, or null. Case and
 * punctuation are ignored, so re-punctuating a copied sentence does not hide it.
 */
export function sharedWordRun(
  candidate: string,
  source: string,
  n: number = VERBATIM_RUN_WORDS,
): string | null {
  const a = words(candidate);
  if (a.length < n) return null;
  const b = words(source);
  const runs = new Set<string>();
  for (let i = 0; i + n <= b.length; i += 1) runs.add(b.slice(i, i + n).join(" "));
  for (let i = 0; i + n <= a.length; i += 1) {
    const run = a.slice(i, i + n).join(" ");
    if (runs.has(run)) return run;
  }
  return null;
}

/** Every string inside a JSON-encoded value: the text a proposal would put into the pack. */
export function proposedStrings(proposed: string): string[] {
  const walk = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(walk)
        : value !== null && typeof value === "object"
          ? Object.values(value).flatMap(walk)
          : [];
  try {
    return walk(JSON.parse(proposed));
  } catch {
    return [];
  }
}

/**
 * packages/kb's field path grammar (kb/src/paths.ts): dotted names, list entries by selector
 * (`[key=E1]`, `[id=K31]`) or index, and `[+]` to append, only at the end.
 */
const FIELD_PATH =
  /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*|\[(\d+|[A-Za-z_][A-Za-z0-9_]*=[^\]]+)\])*(\[\+\])?$/;

export const kbNormalize = defineTask({
  name: "kb.normalize",
  agent: "kb.normalize",
  input: KbNormalizeInput,
  output: KbNormalizeOutput,
  outputName: "KbNormalizeOutput",
  buildMessages: (input) => {
    const { source } = input;
    const header = [
      `School: ${input.school} | cycle ${input.cycle}`,
      `Source: ${JSON.stringify(source.title)} | type ${source.type} | trust ${source.trust}/5${source.url ? ` | ${source.url}` : ""}`,
      source.type === "third_party_reference"
        ? "This source is third-party reference material (§9.6): every proposal must be rewritten in your own words, with rewritten_in_own_words true, and must not copy any run of its wording."
        : null,
      `Source text length: ${source.text.length} characters. Offsets count from 0 into the source text, excluding the block tags.`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    return [
      {
        role: "user",
        content: [
          header,
          untrustedBlock("current_pack", input.current_pack),
          untrustedBlock("source", source.text),
          "Propose the field-level updates this source supports.",
        ].join("\n\n"),
      },
    ];
  },
  check: (output, input) => {
    const issues: ValidationIssue[] = [];
    const { source } = input;
    const thirdParty = source.type === "third_party_reference";
    output.proposals.forEach((proposal, index) => {
      const path = `proposals.${index}`;
      if (!FIELD_PATH.test(proposal.field_path))
        issues.push({
          path: `${path}.field_path`,
          message:
            'Use a dotted path with list entries by selector, e.g. "application.essays[key=E1].limit.value", or "values.stated[+]" to add',
        });
      const span = proposal.source_span;
      if (span && (span.start >= span.end || span.end > source.text.length))
        issues.push({
          path: `${path}.source_span`,
          message: `The span must satisfy start < end <= ${source.text.length} (the source text length)`,
        });
      if (thirdParty) {
        if (!proposal.rewritten_in_own_words)
          issues.push({
            path: `${path}.rewritten_in_own_words`,
            message:
              "Third-party reference material is never copied: rewrite it and set this to true",
          });
        for (const text of proposedStrings(proposal.proposed)) {
          const run = sharedWordRun(text, source.text);
          if (run)
            issues.push({
              path: `${path}.proposed`,
              message: `Copies the third-party source word for word ("${run}"); rewrite it in your own words`,
            });
        }
      }
    });
    return issues;
  },
});

export const kbRefreshCheck = defineTask({
  name: "kb.refresh_check",
  agent: "kb.refresh_check",
  input: KbRefreshCheckInput,
  output: KbRefreshCheckOutput,
  outputName: "KbRefreshCheckOutput",
  allowedDomains: (input) => input.allowed_domains,
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        [
          `School: ${input.school}`,
          `Page: ${input.url} (watched for: ${input.url_kind})`,
          `Web search is limited to: ${input.allowed_domains.join(", ")}`,
        ].join("\n"),
        untrustedBlock("previous_snapshot", input.old_text),
        untrustedBlock("current_page", input.new_text),
        "Say whether anything an applicant relies on changed between the two versions, and which pack fields it affects.",
      ].join("\n\n"),
    },
  ],
  check: (output) =>
    !output.changed && output.affected_fields.length > 0
      ? [{ path: "affected_fields", message: "Must be empty when changed is false" }]
      : output.changed && output.affected_fields.length === 0
        ? [
            {
              path: "affected_fields",
              message: "Name at least one affected pack field when changed is true",
            },
          ]
        : [],
});
