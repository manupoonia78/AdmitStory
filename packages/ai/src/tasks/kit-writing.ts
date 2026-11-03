// The kit pipeline's writing agents after the Strategist (spec §5.7 stages 4–8): Gap Finder,
// Angle Maker, Writer (draft and coach modes), Short-form Writer and Critic. Each reads the full
// compiled pack (L1) and the compact dossier (L2) from the cached prefix. The rules below are the
// ones a JSON Schema cannot express; a violation gets the single repair attempt (§8.4 step 6).

import { count, ngrams, paragraphText } from "@admitstory/linters";
import type { DraftDoc } from "@admitstory/linters";
import { parseCode } from "@admitstory/shared";
import {
  GAP_BLOCKING_MAX,
  TALKING_POINTS_PER_QUESTION,
  VIDEO_STRUCTURE_SECONDS,
  citableCodes,
  dossierStoryCodes,
  unresolvedCites,
  type Angle,
  type Paragraph,
} from "@admitstory/shared/kit";
import type { ValidationIssue } from "../errors";
import { retrievalBlocks } from "../request";
import {
  KitAnglesInput,
  KitAnglesOutput,
  KitCriticInput,
  KitCriticOutput,
  KitDraftInput,
  KitDraftOutput,
  KitGapsInput,
  KitGapsOutput,
  KitShortformInput,
  KitShortformOutput,
} from "../schemas";
import type { LimitRule } from "../schemas/kit-writing";
import { defineTask, type TaskLayers } from "./define";
import {
  draftProvenanceIssues,
  materialFor,
  needIssues,
  normaliseLine,
  paragraphIdIssues,
} from "./provenance";

/* Rendering --------------------------------------------------------------------------------- */

const LIMIT_UNITS: Record<LimitRule["kind"], string> = {
  words: "words",
  chars_incl_spaces: "characters including spaces",
  chars_excl_spaces: "characters excluding spaces",
};

export function limitLabel(limit: LimitRule | null): string {
  return limit ? `${limit.value} ${LIMIT_UNITS[limit.kind]}` : "none";
}

interface DeliverableLike {
  key: string;
  kind: string;
  prompt: string;
  parts: string[];
  limit: LimitRule | null;
  list_items: number | null;
  archetypes: string[];
  pack_code: string | null;
}

function deliverableBlock(d: DeliverableLike): string {
  const head = [
    d.key,
    d.kind,
    `limit: ${limitLabel(d.limit)}${d.list_items ? ` per item, ${d.list_items} items` : ""}`,
    `archetypes: ${d.archetypes.join(",") || "none"}`,
    `pack: ${d.pack_code ?? "none"}`,
  ].join(" | ");
  const parts = d.parts.length ? `\n  parts: ${d.parts.join("; ")}` : "";
  return `${head}\n  prompt: ${JSON.stringify(d.prompt)}${parts}`;
}

const json = (value: unknown) => JSON.stringify(value);

/* Shared checks ----------------------------------------------------------------------------- */

const issue = (path: string, message: string): ValidationIssue => ({ path, message });

function storyIssues(codes: readonly (string | null)[], stories: Set<string>, path: string) {
  return codes.flatMap((code, i) =>
    code !== null && !stories.has(code)
      ? [issue(`${path}.${i}`, `${code} is not a story in the dossier snapshot`)]
      : [],
  );
}

const wordsOf = (text: string) =>
  new Set(
    normaliseLine(text)
      .split(/[^\p{L}\p{N}']+/u)
      .filter(Boolean),
  );

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/* kit.gaps (§8.5.6) -------------------------------------------------------------------------- */

export const kitGaps = defineTask({
  name: "kit.gaps",
  agent: "kit.gaps",
  input: KitGapsInput,
  output: KitGapsOutput,
  outputName: "KitGapsOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Deliverables:\n${input.deliverables.map(deliverableBlock).join("\n")}`,
        `File map (from the Strategist):\n${json(input.file_map)}`,
        "List the details this plan needs that the dossier lacks.",
      ].join("\n\n"),
    },
  ],
  check: (output, input, layers) => {
    const keys = new Set(input.deliverables.map((d) => d.key));
    const stories = dossierStoryCodes(layers.dossier ?? "");
    const issues: ValidationIssue[] = [];
    const blocking = output.gaps.filter((g) => g.blocking).length;
    if (blocking > GAP_BLOCKING_MAX)
      issues.push(
        issue(
          "gaps",
          `${blocking} blocking questions; at most ${GAP_BLOCKING_MAX}. Keep the ones a draft would be hollow without and mark the rest blocking: false.`,
        ),
      );
    output.gaps.forEach((gap, i) => {
      if (!keys.has(gap.deliverable_key))
        issues.push(
          issue(`gaps.${i}.deliverable_key`, `Unknown deliverable "${gap.deliverable_key}"`),
        );
    });
    issues.push(
      ...storyIssues(
        output.gaps.map((g) => g.story),
        stories,
        "gaps.story",
      ),
    );
    return issues;
  },
});

/* kit.angles (§8.5.7) ------------------------------------------------------------------------ */

/** Angle rules: 1–3 per essay labelled A, B, C; one recommended; genuinely different; 4–5 beats. */
export function angleIssues(
  output: KitAnglesOutput,
  input: {
    essays: DeliverableLike[];
    file_map: { items: { deliverable_key: string; primary_story: string | null }[] };
  },
  stories: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byEssay = new Map<string, { angle: Angle; index: number }[]>();
  output.angles.forEach((angle, index) => {
    const list = byEssay.get(angle.deliverable_key) ?? [];
    list.push({ angle, index });
    byEssay.set(angle.deliverable_key, list);
  });
  const essays = new Map(input.essays.map((e) => [e.key, e] as const));
  for (const key of byEssay.keys())
    if (!essays.has(key)) issues.push(issue("angles", `"${key}" is not one of the long essays`));
  const singles = new Set(output.single_angle.map((s) => s.deliverable_key));

  for (const essay of input.essays) {
    const angles = byEssay.get(essay.key) ?? [];
    if (angles.length === 0 || angles.length > 3) {
      issues.push(issue("angles", `"${essay.key}" needs 1 to 3 angles, has ${angles.length}`));
      continue;
    }
    angles.forEach(({ angle, index }, i) => {
      const expected = ["A", "B", "C"][i];
      if (angle.label !== expected)
        issues.push(
          issue(`angles.${index}.label`, `Label the angles of "${essay.key}" A, B, C in order`),
        );
      if (angle.beats.length < 4 || angle.beats.length > 5)
        issues.push(
          issue(`angles.${index}.beats`, "Give 4 or 5 beats, each with its word allocation"),
        );
      const total = angle.beats.reduce((sum, b) => sum + b.words, 0);
      if (essay.limit?.kind === "words" && total > essay.limit.value)
        issues.push(
          issue(
            `angles.${index}.beats`,
            `Beats allocate ${total} words; the limit is ${essay.limit.value}`,
          ),
        );
      issues.push(...storyIssues(angle.stories, stories, `angles.${index}.stories`));
    });
    const recommended = angles.filter(({ angle }) => angle.recommended);
    if (recommended.length !== 1)
      issues.push(issue("angles", `Recommend exactly one angle for "${essay.key}"`));
    const planned = input.file_map.items.find(
      (i) => i.deliverable_key === essay.key,
    )?.primary_story;
    const pick = recommended[0];
    if (planned && pick && !pick.angle.stories.includes(planned))
      issues.push(
        issue(
          `angles.${pick.index}.stories`,
          `The recommended angle must use the file map's primary story for "${essay.key}" (${planned})`,
        ),
      );
    if ((angles.length === 1) !== singles.has(essay.key))
      issues.push(
        issue(
          "single_angle",
          angles.length === 1
            ? `"${essay.key}" has one angle: say why in single_angle`
            : `"${essay.key}" has ${angles.length} angles: remove it from single_angle`,
        ),
      );
    for (let a = 0; a < angles.length; a += 1)
      for (let b = a + 1; b < angles.length; b += 1) {
        const first = angles[a];
        const second = angles[b];
        if (!first || !second) continue;
        const x = first.angle;
        const y = second.angle;
        const sameStories = [...x.stories].sort().join() === [...y.stories].sort().join();
        if (sameStories && jaccard(wordsOf(x.opening_line), wordsOf(y.opening_line)) >= 0.5)
          issues.push(
            issue(
              `angles.${second.index}`,
              `Angles ${x.label} and ${y.label} of "${essay.key}" are wording variants: change the entry scene, the story combination or the structure`,
            ),
          );
      }
  }
  return issues;
}

export const kitAngles = defineTask({
  name: "kit.angles",
  agent: "kit.angles",
  input: KitAnglesInput,
  output: KitAnglesOutput,
  outputName: "KitAnglesOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Long essays (angles for every one, in this call):\n${input.essays.map(deliverableBlock).join("\n")}`,
        `File map (from the Strategist):\n${json(input.file_map)}`,
        `Lead traits at this school: ${input.lead_traits.join(", ") || "none given"}`,
        "Produce the angles.",
      ].join("\n\n"),
    },
  ],
  check: (output, input, layers) => [
    ...angleIssues(output, input, dossierStoryCodes(layers.dossier ?? "")),
    ...unresolvedCites(
      output,
      citableCodes({ dossier: layers.dossier, schoolPack: layers.schoolPack }),
    ),
  ],
});

/* kit.draft (§8.5.8, §8.10) ------------------------------------------------------------------ */

/** Every prompt part maps to at least one paragraph of the draft (§8.8 promptParts). */
export function promptPartIssues(
  parts: readonly string[],
  answered: readonly { part: string; paragraph_ids: string[] }[],
  paragraphIds: ReadonlySet<string>,
  path: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  parts.forEach((part, i) => {
    const entry =
      answered.find((a) => normaliseLine(a.part) === normaliseLine(part)) ?? answered[i];
    if (!entry || !entry.paragraph_ids.some((id) => paragraphIds.has(id)))
      issues.push(
        issue(path, `Prompt part "${part}" is not mapped to a paragraph that answers it`),
      );
  });
  answered.forEach((a, i) =>
    a.paragraph_ids.forEach((id, j) => {
      if (!paragraphIds.has(id))
        issues.push(issue(`${path}.${i}.paragraph_ids.${j}`, `No paragraph "${id}"`));
    }),
  );
  return issues;
}

/** Coach mode (§8.10): the applicant's lines are their golden lines, word for word. */
export function coachIssues(
  coach: NonNullable<KitDraftOutput["coach"]>,
  lines: ReadonlyMap<string, string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  coach.beats.forEach((beat, b) => {
    if (beat.questions.length === 0)
      issues.push(
        issue(
          `coach.beats.${b}.questions`,
          "Each beat asks at least one question for the applicant to answer in their own writing",
        ),
      );
    beat.your_lines.forEach((line, l) => {
      const path = `coach.beats.${b}.your_lines.${l}`;
      const golden = lines.get(line.source);
      if (parseCode(line.source)?.kind !== "line" || golden === undefined)
        issues.push(
          issue(
            `${path}.source`,
            `${line.source} is not a golden line in the dossier; your_lines are golden lines only`,
          ),
        );
      else if (normaliseLine(golden) !== normaliseLine(line.text))
        issues.push(
          issue(`${path}.text`, `Must be ${line.source} word for word: ${JSON.stringify(golden)}`),
        );
    });
  });
  return issues;
}

export const kitDraft = defineTask({
  name: "kit.draft",
  agent: "kit.draft",
  input: KitDraftInput,
  output: KitDraftOutput,
  outputName: "KitDraftOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => {
    const others =
      input.other_deliverables.length === 0
        ? "Other deliverables in this file: none yet."
        : `Other deliverables in this file (never repeat their lines or images):\n${input.other_deliverables
            .map(
              (o) =>
                `${o.key} | primary: ${o.primary_story ?? "none"} | first: ${json(o.first_line)} | last: ${json(o.last_line)}`,
            )
            .join("\n")}`;
    return [
      {
        role: "user",
        content: [
          `Mode: ${input.mode}`,
          `Deliverable:\n${deliverableBlock(input.deliverable)}`,
          `Chosen angle:\n${json(input.angle)}`,
          `File map entry:\n${json(input.file_map_item)}`,
          others,
          retrievalBlocks(input.retrieval),
          input.mode === "draft"
            ? "Write the essay. Return draft, and coach: null."
            : "Coach mode: return coach, and draft: null. No composed prose.",
        ].join("\n\n"),
      },
    ];
  },
  check: (output, input, layers) => {
    const issues: ValidationIssue[] = [];
    const material = materialFor(layers, input.retrieval);
    if (input.mode === "draft") {
      if (output.draft === null || output.coach !== null)
        return [issue("", "Draft mode: return draft and set coach to null")];
      const draft = output.draft;
      issues.push(...paragraphIdIssues(draft, "draft"));
      issues.push(...draftProvenanceIssues(draft, material, "draft"));
      issues.push(...needIssues(draft, draft.needs, "draft.needs"));
      issues.push(
        ...promptPartIssues(
          input.deliverable.parts,
          draft.prompt_parts_answered,
          new Set(draft.paragraphs.map((p) => p.id)),
          "draft.prompt_parts_answered",
        ),
      );
      issues.push(
        ...unresolvedCites(draft.notes, material.known).map((i) => ({
          ...i,
          path: `draft.notes.${i.path}`,
        })),
      );
    } else {
      if (output.coach === null || output.draft !== null)
        return [issue("", "Coach mode: return coach and set draft to null")];
      issues.push(...coachIssues(output.coach, material.dossier.lines));
      issues.push(
        ...unresolvedCites(output.coach, material.known).map((i) => ({
          ...i,
          path: `coach.${i.path}`,
        })),
      );
    }
    return issues;
  },
});

/* kit.shortform (§8.5.9, §5.9) --------------------------------------------------------------- */

type ShortformDeliverable = DeliverableLike;

/** Video and interview items are talking points only (§8.10); list prompts are lists. */
export function expectedFormat(d: ShortformDeliverable): "prose" | "list" | "talking_points" {
  if (d.kind === "video" || d.kind === "interview_question" || d.archetypes.includes("VIDEO"))
    return "talking_points";
  if (d.list_items !== null || d.archetypes.includes("LIST")) return "list";
  return "prose";
}

const APPLICANT_KINDS = new Set(["fact", "story", "line", "conversation"]);

export function shortformIssues(
  output: KitShortformOutput,
  input: { items: ShortformDeliverable[]; essay_lines: string[] },
  layers: TaskLayers,
  retrieval: readonly { id: string; verified_at: string | null }[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const material = materialFor(layers, retrieval);
  const wanted = new Map(input.items.map((d) => [d.key, d] as const));
  const seen = new Map<string, number>();
  const essayGrams = new Set(input.essay_lines.flatMap((line) => [...ngrams(line)]));

  const hasGoalFields = input.items.some((d) => d.kind === "goal_field");
  const statement = output.goals_statement;
  if (hasGoalFields && statement === null)
    issues.push(
      issue(
        "goals_statement",
        "Write the full goals statement first, then split it across the goal fields",
      ),
    );
  if (!hasGoalFields && statement !== null)
    issues.push(issue("goals_statement", "Must be null: this school has no goal fields"));
  const statementLines = new Set((statement ?? []).map((s) => normaliseLine(s.text)));
  if (statement)
    issues.push(
      ...draftProvenanceIssues(
        { paragraphs: [{ id: "goals", sentences: statement }] },
        material,
        "goals_statement",
      ).map((i) => ({
        ...i,
        path: i.path.replace("goals_statement.paragraphs.0.", "goals_statement."),
      })),
    );

  output.items.forEach((item, i) => {
    const path = `items.${i}`;
    const d = wanted.get(item.deliverable_key);
    seen.set(item.deliverable_key, (seen.get(item.deliverable_key) ?? 0) + 1);
    if (!d) {
      issues.push(issue(`${path}.deliverable_key`, `Unknown item "${item.deliverable_key}"`));
      return;
    }
    const format = expectedFormat(d);
    if (item.format !== format)
      issues.push(issue(`${path}.format`, `"${d.key}" is answered as ${format}`));
    const doc: DraftDoc = { paragraphs: item.paragraphs };

    if (format === "talking_points") {
      if (item.paragraphs.length > 0)
        issues.push(
          issue(`${path}.paragraphs`, "Never a script: talking points only, no paragraphs"),
        );
      if (!item.video)
        issues.push(issue(`${path}.video`, "Give the questions, talking points and structure"));
      else {
        item.video.questions.forEach((q, j) => {
          if (q.points.length !== TALKING_POINTS_PER_QUESTION)
            issues.push(
              issue(
                `${path}.video.questions.${j}.points`,
                `Exactly ${TALKING_POINTS_PER_QUESTION} talking points per question`,
              ),
            );
        });
        const { seconds, segments } = item.video.structure;
        if (!(VIDEO_STRUCTURE_SECONDS as readonly number[]).includes(seconds))
          issues.push(issue(`${path}.video.structure.seconds`, "A 60- or 90-second structure"));
        const total = segments.reduce((sum, s) => sum + s.seconds, 0);
        if (total !== seconds)
          issues.push(
            issue(
              `${path}.video.structure.segments`,
              `Segments add up to ${total}s, not ${seconds}s`,
            ),
          );
        issues.push(
          ...unresolvedCites(item.video, material.known).map((x) => ({
            ...x,
            path: `${path}.video.${x.path}`,
          })),
        );
      }
      return;
    }

    if (item.video !== null) issues.push(issue(`${path}.video`, "Must be null for a written item"));
    // An answer that rests entirely on a missing detail is only its need: nothing to write
    // around yet, and nothing invented to fill the box.
    if (item.paragraphs.length === 0) {
      if (item.needs.length === 0)
        issues.push(
          issue(`${path}.paragraphs`, "Write the answer, or a need where the detail is missing"),
        );
    } else issues.push(...needIssues(doc, item.needs, `${path}.needs`));
    issues.push(...paragraphIdIssues(doc, path));
    issues.push(...draftProvenanceIssues(doc, material, path));

    if (format === "list") {
      if (d.list_items !== null && item.paragraphs.length !== d.list_items)
        issues.push(
          issue(
            `${path}.paragraphs`,
            `The prompt asks for ${d.list_items} items, one paragraph each`,
          ),
        );
      const toned = new Set(item.list_tones.map((t) => t.paragraph_id));
      if (item.paragraphs.some((p) => !toned.has(p.id)) || toned.size !== item.list_tones.length)
        issues.push(issue(`${path}.list_tones`, "Give each list item exactly one tone"));
    }

    const limit = d.limit;
    if (limit) {
      const texts =
        format === "list" && d.list_items !== null
          ? item.paragraphs.map(paragraphText)
          : [item.paragraphs.map(paragraphText).join("\n\n")];
      texts.forEach((text, t) => {
        const used = count(text, limit.kind);
        if (used > limit.value)
          issues.push(
            issue(
              format === "list" && d.list_items !== null
                ? `${path}.paragraphs.${t}`
                : `${path}.paragraphs`,
              `${used} ${LIMIT_UNITS[limit.kind]}; the limit is ${limit.value}. Trim it.`,
            ),
          );
      });
    }

    if (d.kind === "goal_field")
      item.paragraphs.forEach((p, pi) =>
        p.sentences.forEach((s, si) => {
          if (!statementLines.has(normaliseLine(s.text)))
            issues.push(
              issue(
                `${path}.paragraphs.${pi}.sentences.${si}`,
                "A goal field is cut from the goals statement: use its sentences as written there",
              ),
            );
        }),
      );

    if (d.archetypes.includes("MICRO") && item.needs.length === 0) {
      const own = item.paragraphs.some((p) =>
        p.sentences.some((s) =>
          s.sources.some((c) => APPLICANT_KINDS.has(parseCode(c)?.kind ?? "")),
        ),
      );
      if (!own)
        issues.push(
          issue(
            `${path}.paragraphs`,
            "A micro answer cites something the applicant has actually done (F, S, L or C)",
          ),
        );
    }

    const text = item.paragraphs.map(paragraphText).join(" ");
    const reused = [...ngrams(text)].find((gram) => essayGrams.has(gram));
    if (reused)
      issues.push(
        issue(
          `${path}.paragraphs`,
          `Repeats essay wording ("${reused}"); short items never reuse essay lines`,
        ),
      );
  });

  for (const key of wanted.keys()) {
    const n = seen.get(key) ?? 0;
    if (n !== 1)
      issues.push(
        issue("items", n === 0 ? `Item "${key}" is missing` : `Item "${key}" appears ${n} times`),
      );
  }
  issues.push(...unresolvedCites({ verify: output.verify }, material.known));
  return issues;
}

export const kitShortform = defineTask({
  name: "kit.shortform",
  agent: "kit.shortform",
  input: KitShortformInput,
  output: KitShortformOutput,
  outputName: "KitShortformOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Short items (all of them, in this call):\n${input.items.map(deliverableBlock).join("\n")}`,
        `File map (from the Strategist):\n${json(input.file_map)}`,
        input.essay_lines.length
          ? `Lines already used in the essays (never repeat them):\n${input.essay_lines.map((l) => `- ${l}`).join("\n")}`
          : "Lines already used in the essays: none yet.",
        retrievalBlocks(input.retrieval),
        "Write the short items.",
      ].join("\n\n"),
    },
  ],
  check: (output, input, layers) => shortformIssues(output, input, layers, input.retrieval),
});

/* kit.critic (§8.5.10) ----------------------------------------------------------------------- */

/** True when `next` only removes words from `original`, in order: a cut, never a rewrite. */
export function isCut(original: string, next: string): boolean {
  const from = normaliseLine(original)
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
  const to = normaliseLine(next)
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
  let i = 0;
  for (const word of to) {
    while (i < from.length && from[i] !== word) i += 1;
    if (i === from.length) return false;
    i += 1;
  }
  return to.length < from.length;
}

/** §8.5.10: "It must not rewrite the essay." */
export const CRITIC_FIX_HINT_MAX_WORDS = 40;

export function criticIssues(
  output: KitCriticOutput,
  draft: { paragraphs: Paragraph[] },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const paragraphs = new Map(draft.paragraphs.map((p) => [p.id, p] as const));
  const locate = (path: string, loc: { paragraph_id: string | null; sentence: number | null }) => {
    if (loc.paragraph_id === null) {
      if (loc.sentence !== null)
        issues.push(issue(`${path}.sentence`, "A sentence needs its paragraph_id"));
      return;
    }
    const p = paragraphs.get(loc.paragraph_id);
    if (!p) issues.push(issue(`${path}.paragraph_id`, `No paragraph "${loc.paragraph_id}"`));
    else if (loc.sentence !== null && loc.sentence >= p.sentences.length)
      issues.push(
        issue(
          `${path}.sentence`,
          `Paragraph "${p.id}" has ${p.sentences.length} sentence(s), counting from 0`,
        ),
      );
  };

  output.findings.forEach((finding, i) => {
    const path = `findings.${i}`;
    locate(`${path}.location`, finding.location);
    if (finding.fix_hint && finding.fix_hint.split(/\s+/).length > CRITIC_FIX_HINT_MAX_WORDS)
      issues.push(
        issue(
          `${path}.fix_hint`,
          `A hint of at most ${CRITIC_FIX_HINT_MAX_WORDS} words; never rewrite the essay`,
        ),
      );
    const patch = finding.patch;
    if (!patch) return;
    const original = paragraphs.get(patch.paragraph_id);
    if (patch.op === "insert_after")
      issues.push(
        issue(
          `${path}.patch.op`,
          "The Critic never adds text: only cuts (replace with fewer words, or delete)",
        ),
      );
    if (!original)
      issues.push(issue(`${path}.patch.paragraph_id`, `No paragraph "${patch.paragraph_id}"`));
    else if (
      patch.op === "replace" &&
      !isCut(paragraphText(original), (patch.sentences ?? []).map((s) => s.text).join(" "))
    )
      issues.push(
        issue(
          `${path}.patch`,
          "A Critic patch only removes words (safe mechanical cuts); it must not rewrite",
        ),
      );
    if (
      finding.location.paragraph_id !== null &&
      finding.location.paragraph_id !== patch.paragraph_id
    )
      issues.push(
        issue(`${path}.patch.paragraph_id`, "The patch edits the paragraph the finding points at"),
      );
  });
  if (output.first_action) {
    const p = paragraphs.get(output.first_action.paragraph_id);
    if (!p || output.first_action.sentence >= p.sentences.length)
      issues.push(issue("first_action", "first_action points at a sentence that does not exist"));
  }
  return issues;
}

export const kitCritic = defineTask({
  name: "kit.critic",
  agent: "kit.critic",
  input: KitCriticInput,
  output: KitCriticOutput,
  outputName: "KitCriticOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => {
    const draft = input.draft.paragraphs
      .map((p) =>
        [
          `[${p.id}]`,
          ...p.sentences.map(
            (s, i) =>
              `  ${i}. ${s.text} (${s.kind}${s.sources.length ? `; ${s.sources.join(",")}` : ""})`,
          ),
        ].join("\n"),
      )
      .join("\n");
    const others = input.other_deliverables
      .map(
        (o) =>
          `${o.key} | primary: ${o.primary_story ?? "none"} | first: ${json(o.first_line)} | last: ${json(o.last_line)}`,
      )
      .join("\n");
    const linters = input.linter_findings
      .map(
        (f) =>
          `${f.severity} ${f.rule_id} @${f.location.paragraph_id ?? "-"}:${f.location.sentence ?? "-"} ${f.explanation}`,
      )
      .join("\n");
    return [
      {
        role: "user",
        content: [
          `Deliverable:\n${deliverableBlock(input.deliverable)}`,
          `Draft (paragraph ids in brackets; sentences numbered from 0):\n${draft}`,
          `File map entry:\n${json(input.file_map_item)}`,
          `Other deliverables in this file:\n${others || "none yet"}`,
          `Linter results (already computed; do not repeat them, build on them):\n${linters || "none"}`,
          "Critique this draft.",
        ].join("\n\n"),
      },
    ];
  },
  check: (output, input) => criticIssues(output, input.draft),
});
