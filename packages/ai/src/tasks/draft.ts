// The Workspace's revision calls (spec §5.8, §8.6): the Reviser's paragraph patches, the one-paragraph
// regeneration after a NEED answer, and the Haiku classifier that picks which paragraphs an
// instruction is about. The patch guard is code, not a prompt rule: a patch that touches a locked
// or hand-edited paragraph, or one the instruction did not target, is rejected and goes to the
// single repair attempt. The server applies patches with applyPatches().

import type { Paragraph, Patch } from "@admitstory/shared/kit";
import { codesIn } from "@admitstory/shared/kit";
import type { ValidationIssue } from "../errors";
import {
  DraftNeedFillInput,
  DraftNeedFillOutput,
  DraftReviseInput,
  DraftReviseOutput,
  UtilClassifyInput,
  UtilClassifyOutput,
} from "../schemas";
import { defineTask } from "./define";
import { limitLabel } from "./kit-writing";
import { draftProvenanceIssues, materialFor, paragraphIdIssues } from "./provenance";

const issue = (path: string, message: string): ValidationIssue => ({ path, message });

const draftCodes = (paragraphs: readonly Paragraph[]) =>
  paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.sources));

function renderDraft(paragraphs: readonly Paragraph[], marks: (id: string) => string): string {
  return paragraphs
    .map((p) => {
      const sentences = p.sentences
        .map(
          (s, i) =>
            `  ${i}. ${s.text} (${s.kind}${s.sources.length ? `; ${s.sources.join(",")}` : ""})`,
        )
        .join("\n");
      return `[${p.id}]${marks(p.id)}\n${sentences}`;
    })
    .join("\n");
}

/* Patch guard -------------------------------------------------------------------------------- */

export interface PatchRules {
  /** Paragraph ids in the current draft. */
  paragraphIds: readonly string[];
  /** The paragraphs the instruction is about (user-selected or util.classify). */
  targets: readonly string[];
  locked: readonly string[];
  userEdited: readonly string[];
}

/**
 * §8.6 and §5.8: patches touch only targeted paragraphs, never a locked one, never one the user
 * edited by hand (the AI never overwrites the user's sentences without asking), and at most one
 * replace or delete per paragraph. `insert_after` anchors on a targeted paragraph.
 */
export function patchGuardIssues(patches: readonly Patch[], rules: PatchRules): ValidationIssue[] {
  const ids = new Set(rules.paragraphIds);
  const targets = new Set(rules.targets);
  const locked = new Set(rules.locked);
  const edited = new Set(rules.userEdited);
  const rewritten = new Set<string>();
  const issues: ValidationIssue[] = [];
  patches.forEach((patch, i) => {
    const path = `patches.${i}.paragraph_id`;
    const id = patch.paragraph_id;
    if (!ids.has(id)) issues.push(issue(path, `No paragraph "${id}" in the draft`));
    else if (locked.has(id))
      issues.push(issue(path, `Paragraph "${id}" is locked: never patch it`));
    else if (edited.has(id))
      issues.push(issue(path, `Paragraph "${id}" was edited by the applicant: never patch it`));
    else if (!targets.has(id))
      issues.push(
        issue(
          path,
          `Paragraph "${id}" is not a target of this instruction: patch only ${[...targets].join(", ")}`,
        ),
      );
    if (patch.op !== "insert_after") {
      if (rewritten.has(id)) issues.push(issue(path, `Paragraph "${id}" is patched twice`));
      rewritten.add(id);
    }
  });
  return issues;
}

/**
 * Applies patches in order. Inserted paragraphs get ids from `newId` (the server's allocator), so
 * ids stay stable across versions. Run patchGuardIssues first; this does not re-check the rules.
 */
export function applyPatches(
  paragraphs: readonly Paragraph[],
  patches: readonly Patch[],
  newId: () => string,
): Paragraph[] {
  const out = paragraphs.map((p) => ({ ...p, sentences: [...p.sentences] }));
  for (const patch of patches) {
    const at = out.findIndex((p) => p.id === patch.paragraph_id);
    if (at < 0) continue;
    if (patch.op === "delete") out.splice(at, 1);
    else if (patch.op === "replace")
      out[at] = { id: patch.paragraph_id, sentences: [...(patch.sentences ?? [])] };
    else out.splice(at + 1, 0, { id: newId(), sentences: [...(patch.sentences ?? [])] });
  }
  return out;
}

/* draft.revise (§8.6) ------------------------------------------------------------------------ */

export const draftRevise = defineTask({
  name: "draft.revise",
  agent: "draft.revise",
  input: DraftReviseInput,
  output: DraftReviseOutput,
  outputName: "RevisionResult",
  requires: ["schoolPack"],
  buildMessages: (input) => {
    const locked = new Set(input.locked_paragraph_ids);
    const edited = new Set(input.user_edited_paragraph_ids);
    const targets = new Set([...input.target_paragraph_ids, ...(input.cut?.paragraph_ids ?? [])]);
    const marks = (id: string) =>
      locked.has(id)
        ? " LOCKED"
        : edited.has(id)
          ? " EDITED BY THE APPLICANT"
          : targets.has(id)
            ? " TARGET"
            : "";
    return [
      {
        role: "user",
        content: [
          `Instruction: ${input.instruction}`,
          `Target paragraphs: ${[...targets].join(", ")}`,
          input.cut
            ? `Limit loop: cut about ${input.cut.words} words from ${input.cut.paragraph_ids.join(", ")}.`
            : "",
          `Limit: ${limitLabel(input.limit)}`,
          `Draft (paragraph ids in brackets; sentences numbered from 0):\n${renderDraft(input.draft.paragraphs, marks)}`,
          input.dossier_items.trim()
            ? `Dossier items for this revision:\n${input.dossier_items.trim()}`
            : "Dossier items for this revision: none beyond the draft's own sources.",
          "Return the patches.",
        ]
          .filter((part) => part !== "")
          .join("\n\n"),
      },
    ];
  },
  check: (output, input, layers) => {
    const paragraphs = input.draft.paragraphs;
    const issues = patchGuardIssues(output.patches, {
      paragraphIds: paragraphs.map((p) => p.id),
      targets: [...input.target_paragraph_ids, ...(input.cut?.paragraph_ids ?? [])],
      locked: input.locked_paragraph_ids,
      userEdited: input.user_edited_paragraph_ids,
    });
    const material = materialFor(layers, [], {
      knownCodes: [...draftCodes(paragraphs), ...codesIn(input.dossier_items)],
      dossierText: input.dossier_items,
    });
    output.patches.forEach((patch, i) => {
      if (!patch.sentences) return;
      issues.push(
        ...draftProvenanceIssues(
          { paragraphs: [{ id: patch.paragraph_id, sentences: patch.sentences }] },
          material,
          `patches.${i}`,
        ).map((x) => ({
          ...x,
          path: x.path.replace(`patches.${i}.paragraphs.0.`, `patches.${i}.`),
        })),
      );
    });
    return issues;
  },
});

/* draft.need_fill (§5.8) --------------------------------------------------------------------- */

export const draftNeedFill = defineTask({
  name: "draft.need_fill",
  agent: "draft.need_fill",
  input: DraftNeedFillInput,
  output: DraftNeedFillOutput,
  outputName: "DraftNeedFillOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Paragraph to regenerate:\n${renderDraft([input.paragraph], () => "")}`,
        `Before it: ${input.before ? JSON.stringify(input.before) : "nothing (it opens the draft)"}`,
        `After it: ${input.after ? JSON.stringify(input.after) : "nothing (it closes the draft)"}`,
        `The question we asked: ${input.need.question} (about ${input.need.approx_words} words)`,
        `The applicant's answer, saved as ${input.answer.code}:\n${JSON.stringify(input.answer.text)}`,
        input.limit_words ? `Keep the paragraph within about ${input.limit_words} words.` : "",
        "Rewrite only this paragraph, using the answer.",
      ]
        .filter((part) => part !== "")
        .join("\n\n"),
    },
  ],
  check: (output, input, layers) => {
    const issues: ValidationIssue[] = [];
    if (output.paragraph.id !== input.paragraph.id)
      issues.push(issue("paragraph.id", `Keep the paragraph id "${input.paragraph.id}"`));
    if (!output.paragraph.sentences.some((s) => s.sources.includes(input.answer.code)))
      issues.push(
        issue(
          "paragraph.sentences",
          `Use the answer: at least one sentence cites ${input.answer.code}`,
        ),
      );
    const material = materialFor(layers, [], {
      knownCodes: [input.answer.code, ...draftCodes([input.paragraph])],
    });
    // The answer is the applicant's own words: a verbatim sentence may quote it.
    const doc = { paragraphs: [output.paragraph] };
    issues.push(...paragraphIdIssues(doc, ""));
    issues.push(
      ...draftProvenanceIssues(doc, material, "").map((x) => ({
        ...x,
        path: x.path.replace(/^paragraphs\.0\./, "paragraph."),
      })),
    );
    return issues;
  },
});

/* util.classify (§8.6 target paragraphs) ----------------------------------------------------- */

export const utilClassify = defineTask({
  name: "util.classify",
  agent: "util.classify",
  input: UtilClassifyInput,
  output: UtilClassifyOutput,
  outputName: "UtilClassifyOutput",
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Instruction: ${JSON.stringify(input.instruction)}`,
        "Paragraphs:",
        ...input.paragraphs.map(
          (p) => `[${p.id}]${p.locked ? " LOCKED" : ""} ${JSON.stringify(p.text)}`,
        ),
      ].join("\n"),
    },
  ],
  check: (output, input) => {
    const ids = new Map(input.paragraphs.map((p) => [p.id, p] as const));
    const issues: ValidationIssue[] = [];
    output.paragraph_ids.forEach((id, i) => {
      const p = ids.get(id);
      if (!p) issues.push(issue(`paragraph_ids.${i}`, `No paragraph "${id}"`));
      else if (p.locked) issues.push(issue(`paragraph_ids.${i}`, `Paragraph "${id}" is locked`));
    });
    if (!output.whole_draft && output.paragraph_ids.length === 0)
      issues.push(issue("paragraph_ids", "Name at least one paragraph, or set whole_draft"));
    return issues;
  },
});
