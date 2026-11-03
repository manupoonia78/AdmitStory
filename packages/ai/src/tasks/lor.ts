// The Recommender Kit's tasks (spec §5.11, §8.5.12; canon A11 lor.md), Phase 6. The rules below
// are the ones a JSON Schema cannot express; a violation gets the single repair attempt (§8.4 step
// 6). Two of them are exported for the app to re-run on stored output:
//
//   - briefCiteIssues: a brief cites only the applicant's own material (F/S/L codes in the
//     snapshot) and this recommender's R stories, every number is in the material it cites, every
//     question is answered verbatim, and nothing reads like a letter (LOR-01).
//   - assistProvenanceIssues: the portal assistant writes only from the recommender's own notes:
//     every sentence cites a note, verbatim means word for word, adapted keeps most of their words,
//     and nothing comes from the applicant's brief (LOR-10, decision 2).

import { count } from "@admitstory/linters";
import { parseCode } from "@admitstory/shared";
import {
  LOR_STORIES_MAX,
  LOR_STRENGTHS_MAX,
  citableCodes,
  citesIn,
  dossierStoryCodes,
  unresolvedCites,
  type LorBrief,
  type RecommenderAssist,
} from "@admitstory/shared/kit";
import type { ValidationIssue } from "../errors";
import { untrustedBlock } from "../request";
import {
  LorBriefInput,
  LorBriefOutput,
  LorExtractInput,
  LorExtractOutput,
  LorPlanInput,
  LorPlanOutput,
  RecommenderAssistInput,
  RecommenderAssistOutput,
  type LimitRule,
} from "../schemas";
import { defineTask } from "./define";
import { newNames, newNumbers } from "./forms";
import { limitLabel } from "./kit-writing";
import { dossierIndex } from "./provenance";

const issue = (path: string, message: string): ValidationIssue => ({ path, message });

/* Text helpers --------------------------------------------------------------------------------- */

/** Lower case, straight quotes, punctuation as spaces, single spaces: for "appears in" checks. */
export function plainText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}'\s]+/gu, " ")
    .replace(/'(?!\p{L})|(?<!\p{L})'/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  (
    "the a an and or but of to in on at for with from by as is was were be been being it its this " +
    "that these those he she they them his her their we our you your i me my so then than there " +
    "what when who how which also very just into over after before about up out not no all any " +
    "had has have did do does can could would should will"
  ).split(" "),
);

const stem = (word: string) =>
  word.length > 4 ? word.replace(/'s$/, "").replace(/(ing|ed|es|ly|s)$/, "") : word;

/** The words that carry meaning, stemmed: what an adapted sentence must mostly keep. */
export function contentWords(text: string): string[] {
  return plainText(text)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

function grams(text: string, n: number): Set<string> {
  const words = plainText(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i += 1) out.add(words.slice(i, i + n).join(" "));
  return out;
}

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
/** Sentence ends: a terminator before a capital letter or the end, so "2 a.m. rollback" is one. */
const sentenceCount = (text: string) =>
  Math.max(1, (text.trim().match(/[.!?](?=\s+["'“‘(]?\p{Lu}|\s*$)/gu) ?? []).length);

const CODE_TOKEN = /\b[FSLPCKR]\d{1,6}\b/;

/**
 * The dossier text behind one code: a fact's line, a story's whole block, a golden line's words,
 * a person's line. "" when the compact dossier has no such code (withheld or invented).
 */
export function dossierTextFor(dossier: string, code: string): string {
  const kind = parseCode(code)?.kind;
  if (kind === "line") return dossierIndex(dossier).lines.get(code) ?? "";
  const rows = dossier.split("\n");
  if (kind === "story") {
    const start = rows.findIndex((row) => row.startsWith(`${code} "`));
    if (start < 0) return "";
    const block = [rows[start] ?? ""];
    for (const row of rows.slice(start + 1)) {
      if (!row.startsWith(" ")) break;
      block.push(row);
    }
    return block.join("\n");
  }
  const re = new RegExp(`(^|\\s)${code}\\b`);
  return rows.filter((row) => re.test(row)).join("\n");
}

/* lor.extract ---------------------------------------------------------------------------------- */

export const lorExtract = defineTask({
  name: "lor.extract",
  agent: "lor.extract",
  input: LorExtractInput,
  output: LorExtractOutput,
  outputName: "LorExtractOutput",
  requires: ["dossier"],
  buildMessages: (input) => {
    const r = input.recommender;
    return [
      {
        role: "user",
        content: [
          `Recommender: ${r.ref} | ${r.name} | ${r.relationship}${r.title ? ` | ${r.title}` : ""}${r.organisation ? `, ${r.organisation}` : ""}`,
          input.confirmed.length > 0
            ? `Stories the applicant already confirmed for this recommender (don't repeat them):\n${input.confirmed
                .map((s) => `${s.code} "${s.title}"`)
                .join("\n")}`
            : "",
          untrustedBlock(
            "intake_answers",
            input.answers.map((a) => `[${a.question_id}]\n${a.text}`).join("\n\n"),
          ),
          `Pull out what ${r.name} saw: the relationship, strengths, stories, the feedback arc and the rest of the intake.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];
  },
  check: (output, input, layers) => {
    const issues: ValidationIssue[] = [];
    const dossier = layers.dossier ?? "";
    const answers = input.answers.map((a) => a.text).join("\n");
    const answersPlain = plainText(answers);

    if (output.stories.length > LOR_STORIES_MAX)
      issues.push(
        issue(
          "stories",
          `${output.stories.length} stories; keep the ${LOR_STORIES_MAX} strongest this recommender saw for themselves.`,
        ),
      );
    if (output.strengths.length > LOR_STRENGTHS_MAX)
      issues.push(
        issue(
          "strengths",
          `${output.strengths.length} strengths; keep at most ${LOR_STRENGTHS_MAX}.`,
        ),
      );

    const refs = new Set<string>();
    const confirmed = new Set(input.confirmed.map((s) => plainText(s.title)));
    output.stories.forEach((story, i) => {
      const at = `stories.${i}`;
      if (refs.has(story.ref))
        issues.push(issue(`${at}.ref`, `Duplicate story ref "${story.ref}"`));
      refs.add(story.ref);
      if (story.your_actions.length === 0)
        issues.push(
          issue(`${at}.your_actions`, "List what the applicant did, in their own steps."),
        );
      if (confirmed.has(plainText(story.title)))
        issues.push(
          issue(`${at}.title`, "The applicant already confirmed this story; leave it out."),
        );

      const fields: [string, string][] = [
        ["what_happened", story.what_happened],
        ["what_they_saw", story.what_they_saw],
        ["result", story.result],
        ...story.your_actions.map((a, j): [string, string] => [`your_actions.${j}`, a]),
        ...story.numbers.map((n, j): [string, string] => [`numbers.${j}`, n]),
      ];
      for (const [field, value] of fields) {
        const numbers = newNumbers(value, answers, dossier);
        if (numbers.length > 0)
          issues.push(
            issue(
              `${at}.${field}`,
              `${numbers.join(", ")} is in neither the answers nor the dossier. Never invent a number: leave it out and add a "missing" question asking for it.`,
            ),
          );
        if (field.startsWith("numbers")) continue;
        const names = newNames(value, answers, dossier);
        if (names.length > 0)
          issues.push(
            issue(
              `${at}.${field}`,
              `${names.join(", ")} is in neither the answers nor the dossier. Don't add names the applicant didn't give.`,
            ),
          );
      }
      if (story.what_they_said !== null && !answersPlain.includes(plainText(story.what_they_said)))
        issues.push(
          issue(
            `${at}.what_they_said`,
            "Quote only words the applicant gave as the recommender's; otherwise set what_they_said to null.",
          ),
        );
    });

    output.strengths.forEach((strength, i) => {
      if (strength.story_ref !== null && !refs.has(strength.story_ref))
        issues.push(
          issue(`strengths.${i}.story_ref`, `No story "${strength.story_ref}" in this output.`),
        );
    });

    if (output.growth && output.growth.steps.length === 0)
      issues.push(
        issue(
          "growth.steps",
          "A growth arc lists the concrete steps taken; otherwise set growth to null.",
        ),
      );

    issues.push(
      ...unresolvedCites(output, citableCodes({ dossier }), ["fact", "story", "line"]).map((i) => ({
        ...i,
        message: `${i.message}. Cite only the dossier's F, S and L codes that tell the same events.`,
      })),
    );
    return issues;
  },
});

/* lor.plan ------------------------------------------------------------------------------------- */

export const lorPlan = defineTask({
  name: "lor.plan",
  agent: "lor.plan",
  input: LorPlanInput,
  output: LorPlanOutput,
  outputName: "LorPlanOutput",
  requires: ["dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Recommenders:\n${input.recommenders
          .map((r) =>
            [
              `${r.ref} | ${r.relationship}${r.title ? ` | ${r.title}` : ""} | known for: ${r.duration ?? "unknown"} | how often: ${r.frequency ?? "unknown"} | saw best: ${r.strengths.join(", ") || "none listed"}`,
              ...r.stories.map(
                (s) =>
                  `  ${s.code} "${s.title}" | traits ${s.traits.join(", ") || "none"} | cites ${s.cites.join(",") || "none"}`,
              ),
            ].join("\n"),
          )
          .join("\n")}`,
        input.essays.length > 0
          ? `Essays across the applicant's schools (school | key | title | primary story | traits shown):\n${input.essays
              .map(
                (e) =>
                  `${e.school} | ${e.key} | ${e.title} | ${e.primary_story ?? "none"} | ${e.traits_shown.join(", ")}`,
              )
              .join("\n")}`
          : "Essays: none drafted yet.",
        input.kit_plans.length > 0
          ? `The file maps' hints (recommender | strengths | stories | facets):\n${input.kit_plans
              .map(
                (p) =>
                  `${p.recommender_id} | ${p.strengths.join(", ")} | ${p.stories.join(",")} | ${p.facets.join("; ")}`,
              )
              .join("\n")}`
          : "",
        input.red_flags.length > 0
          ? `Red flags to address through a recommender:\n${input.red_flags.map((f) => `- ${f.flag}: ${f.how}`).join("\n")}`
          : "",
        "Plan who covers what.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ],
  check: (output, input, layers) => {
    const issues: ValidationIssue[] = [];
    const dossierStories = dossierStoryCodes(layers.dossier ?? "");
    const ownStories = new Map(
      input.recommenders.map((r) => [r.ref, new Set(r.stories.map((s) => s.code))]),
    );
    const allR = new Set(input.recommenders.flatMap((r) => r.stories.map((s) => s.code)));
    const resolves = (code: string, ref: string | null) =>
      dossierStories.has(code) || (ref === null ? allR.has(code) : ownStories.get(ref)?.has(code));

    const seen = new Map<string, number>();
    output.assignments.forEach((a, i) => {
      if (!ownStories.has(a.recommender))
        issues.push(
          issue(`assignments.${i}.recommender`, `No recommender "${a.recommender}" in the input.`),
        );
      if (seen.has(a.recommender))
        issues.push(
          issue(`assignments.${i}.recommender`, `${a.recommender} has two assignments; give one.`),
        );
      seen.set(a.recommender, i);
    });
    for (const r of input.recommenders)
      if (!seen.has(r.ref)) issues.push(issue("assignments", `Give ${r.ref} an assignment too.`));

    const strengthOwner = new Map<string, string>();
    output.assignments.forEach((a, i) => {
      const at = `assignments.${i}`;
      if (a.strengths.length < 2 || a.strengths.length > 3)
        issues.push(
          issue(
            `${at}.strengths`,
            `Give each recommender 2–3 strengths (${a.strengths.length} here).`,
          ),
        );
      a.strengths.forEach((trait, j) => {
        const other = strengthOwner.get(trait);
        if (other && other !== a.recommender)
          issues.push(
            issue(
              `${at}.strengths.${j}`,
              `${trait} is already ${other}'s strength. Two recommenders, two vantage points (LOR-03): give each different strengths.`,
            ),
          );
        strengthOwner.set(trait, a.recommender);
      });
      const check = (code: string, path: string) => {
        if (!resolves(code, a.recommender))
          issues.push(
            issue(
              path,
              `${code} is neither a dossier story (S) nor one of ${a.recommender}'s own stories (R).`,
            ),
          );
      };
      a.stories.forEach((code, j) => check(code, `${at}.stories.${j}`));
      a.facets.forEach((f, j) => check(f.story, `${at}.facets.${j}.story`));
      a.avoid.forEach((v, j) => {
        if (!resolves(v.story, null))
          issues.push(
            issue(`${at}.avoid.${j}.story`, `${v.story} is not a story in the material.`),
          );
      });
      a.facets.forEach((f, j) => {
        const essay = input.essays.find(
          (e) => e.primary_story === f.story && e.traits_shown.some((t) => a.strengths.includes(t)),
        );
        if (essay)
          issues.push(
            issue(
              `${at}.facets.${j}`,
              `${f.story} is ${essay.school}'s "${essay.title}" main story, shown for the same trait. Give ${a.recommender} another story or side of it, and list this one in avoid with because "essay".`,
            ),
          );
      });
    });

    // A story two recommenders both tell needs different facets and different evidence.
    const facets = output.assignments.flatMap((a, i) =>
      a.facets.map((f, j) => ({
        ...f,
        recommender: a.recommender,
        path: `assignments.${i}.facets.${j}`,
      })),
    );
    facets.forEach((f, x) => {
      for (const g of facets.slice(x + 1)) {
        if (g.recommender === f.recommender || g.story !== f.story) continue;
        if (
          plainText(g.facet) === plainText(f.facet) ||
          plainText(g.evidence) === plainText(f.evidence)
        )
          issues.push(
            issue(
              g.path,
              `${f.recommender} and ${g.recommender} both cover ${f.story} the same way. Give each a different facet and different evidence.`,
            ),
          );
      }
    });

    output.red_flags.forEach((f, i) => {
      if (!ownStories.has(f.recommender))
        issues.push(issue(`red_flags.${i}.recommender`, `No recommender "${f.recommender}".`));
    });
    return issues;
  },
});

/* lor.brief ------------------------------------------------------------------------------------ */

export interface BriefCiteContext {
  /** The compact dossier snapshot (L2) the brief was written from. */
  dossier: string;
  /** This recommender's R codes. */
  storyCodes: readonly string[];
  /** Each R code's story as text (title, fields, numbers), for the number check. */
  storyText: Readonly<Record<string, string>>;
  /** Every school in the group with its questions, as given to the model. */
  questions: readonly {
    school_cycle_id: string;
    questions: readonly { id: string; text_verbatim: string }[];
  }[];
  /** The stories this recommender's assignment covers; a talking point's story must be one. */
  assigned?: readonly string[];
}

const LETTER_PROSE: readonly RegExp[] = [
  /\bI (have|had)? ?(known|worked with|managed|supervised)\b/i,
  /\b(highly|strongly|wholeheartedly) recommend\b/i,
  /\bwithout reservation\b/i,
  /\bto whom it may concern\b/i,
  /^dear\b/im,
  /\bit is my (pleasure|privilege)\b/i,
];
const OFFERS_A_LETTER = /\b(a|the|your|my) (first |rough )?draft\b|\bsample letter\b|\btemplate\b/i;
const NOT_TRAINABLE =
  /\b(integrity|honest|honesty|dishonest\w*|ethic\w*|arrogan\w*|personality)\b/i;
const OWN_KINDS = new Set(["fact", "story", "line", "lor_story"]);

/** The material text behind a set of cites: dossier lines for F/S/L, story text for R codes. */
function materialText(ctx: BriefCiteContext, codes: readonly string[]): string {
  return codes
    .map((code) =>
      parseCode(code)?.kind === "lor_story"
        ? (ctx.storyText[code] ?? "")
        : dossierTextFor(ctx.dossier, code),
    )
    .join("\n");
}

/**
 * The "briefs cite only dossier facts" rule (plan §4): cites, numbers, questions verbatim, no
 * letter prose, the development area trainable. Pure; the app re-runs it on stored briefs.
 */
export function briefCiteIssues(brief: LorBrief, ctx: BriefCiteContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = citableCodes({ dossier: ctx.dossier });
  const stories = new Set(ctx.storyCodes);
  const dossierStories = dossierStoryCodes(ctx.dossier);

  // 2. Every cite is the applicant's own material or this recommender's story.
  for (const { path, code } of citesIn(brief)) {
    const kind = parseCode(code)?.kind;
    if (!kind || !OWN_KINDS.has(kind))
      issues.push(
        issue(
          path,
          `${code}: a brief cites the applicant's own facts only (F, S and L codes, and this recommender's R stories), never the school's pack, a conversation or a person.`,
        ),
      );
    else if (kind === "lor_story" && !stories.has(code))
      issues.push(issue(path, `${code} is not one of this recommender's stories.`));
    else if (kind !== "lor_story" && !known.has(code))
      issues.push(issue(path, `${code} does not exist in the dossier provided.`));
  }

  const needsCite = (cites: readonly string[], path: string, what: string) => {
    if (cites.length === 0)
      issues.push(issue(`${path}.cites`, `Cite the material ${what} comes from.`));
  };
  const numbersIn = (text: string, cites: readonly string[], path: string) => {
    if (cites.length === 0) return;
    const numbers = newNumbers(text, "", materialText(ctx, cites));
    if (numbers.length > 0)
      issues.push(
        issue(
          path,
          `${numbers.join(", ")} is not in the material this cites (${cites.join(", ")}). Use numbers exactly as the cited story or fact gives them, or leave the number out.`,
        ),
      );
  };
  const prose = (text: string, path: string) => {
    for (const re of LETTER_PROSE)
      if (re.test(text))
        issues.push(
          issue(
            path,
            "This reads like letter prose. A brief is factual bullets for the recommender to draw on; never write the letter (LOR-01).",
          ),
        );
    if (CODE_TOKEN.test(text))
      issues.push(issue(path, "Put codes in cites, not in the text the recommender reads."));
  };

  // 4. Every school and question once, verbatim, with 2–5 points.
  const expected = new Map(ctx.questions.map((s) => [s.school_cycle_id, s]));
  const seenSchools = new Set<string>();
  brief.schools.forEach((school, si) => {
    const at = `schools.${si}`;
    const spec = expected.get(school.school_cycle_id);
    if (!spec) {
      issues.push(issue(`${at}.school_cycle_id`, `Unknown school "${school.school_cycle_id}".`));
      return;
    }
    if (seenSchools.has(school.school_cycle_id))
      issues.push(issue(`${at}.school_cycle_id`, "Each school appears once."));
    seenSchools.add(school.school_cycle_id);
    const seenQuestions = new Set<string>();
    school.questions.forEach((q, qi) => {
      const where = `${at}.questions.${qi}`;
      const input = spec.questions.find((x) => x.id === q.question_id);
      if (!input) {
        issues.push(
          issue(`${where}.question_id`, `No question "${q.question_id}" for this school.`),
        );
        return;
      }
      if (seenQuestions.has(q.question_id))
        issues.push(issue(`${where}.question_id`, "Each question appears once."));
      seenQuestions.add(q.question_id);
      if (plainText(q.question_verbatim) !== plainText(input.text_verbatim))
        issues.push(
          issue(`${where}.question_verbatim`, "Copy the school's question exactly as given."),
        );
      if (q.talking_points.length < 2 || q.talking_points.length > 5)
        issues.push(
          issue(
            `${where}.talking_points`,
            `Give 2–5 talking points per question (${q.talking_points.length} here).`,
          ),
        );
      q.talking_points.forEach((p, pi) => {
        const path = `${where}.talking_points.${pi}`;
        needsCite(p.cites, path, "this point");
        numbersIn(`${p.point}\n${p.evidence}`, [...p.cites, ...(p.story ? [p.story] : [])], path);
        // 5. Bullets, not paragraphs.
        if (wordCount(p.point) > 35 || sentenceCount(p.point) > 2)
          issues.push(
            issue(
              `${path}.point`,
              "A talking point is one factual bullet: at most 35 words and 2 sentences.",
            ),
          );
        prose(p.point, `${path}.point`);
        prose(p.evidence, `${path}.evidence`);
        prose(p.facet, `${path}.facet`);
        if (p.story !== null) {
          const kind = parseCode(p.story)?.kind;
          const ok =
            (kind === "lor_story" && stories.has(p.story)) ||
            (kind === "story" && dossierStories.has(p.story));
          if (!ok)
            issues.push(
              issue(
                `${path}.story`,
                `${p.story} is neither this recommender's story nor a dossier story.`,
              ),
            );
          // 6. Only the stories this recommender's plan gives them.
          else if (ctx.assigned && !ctx.assigned.includes(p.story))
            issues.push(
              issue(
                `${path}.story`,
                `${p.story} isn't in this recommender's assignment. Use their own stories, so the two letters don't overlap.`,
              ),
            );
        }
      });
    });
    for (const q of spec.questions)
      if (!seenQuestions.has(q.id))
        issues.push(issue(at, `Answer question "${q.id}" too, with 2–5 talking points.`));
  });
  for (const id of expected.keys())
    if (!seenSchools.has(id)) issues.push(issue("schools", `Cover school "${id}" too.`));

  brief.traits_to_reinforce.forEach((t, i) => {
    const path = `traits_to_reinforce.${i}`;
    needsCite(t.cites, path, "this trait");
    numbersIn(t.why, t.cites, `${path}.why`);
    prose(t.why, `${path}.why`);
  });
  brief.key_facts.forEach((f, i) => {
    const path = `key_facts.${i}`;
    needsCite(f.cites, path, "this fact");
    numbersIn(f.text, f.cites, `${path}.text`);
    prose(f.text, `${path}.text`);
  });
  brief.other_recommender_covers.forEach((c, i) => prose(c, `other_recommender_covers.${i}`));

  const arc = brief.development_arc;
  if (arc) {
    needsCite(arc.cites, "development_arc", "this arc");
    const all = [arc.feedback, arc.response, ...arc.steps, arc.evidence].join("\n");
    numbersIn(all, arc.cites, "development_arc");
    [arc.feedback, arc.response, arc.evidence, ...arc.steps].forEach((t) =>
      prose(t, "development_arc"),
    );
    // 7. LOR-06.
    if (NOT_TRAINABLE.test(`${arc.feedback}\n${arc.response}`))
      issues.push(
        issue(
          "development_arc.feedback",
          "The development area must be trainable, never integrity, honesty, ethics, arrogance or personality (LOR-06). Pick another piece of feedback or set it to null.",
        ),
      );
  }

  // The cover note is the applicant's: short, and never an offer of a draft.
  if (wordCount(brief.cover_note) > 180)
    issues.push(issue("cover_note", "Keep the cover note under 180 words."));
  if (OFFERS_A_LETTER.test(brief.cover_note))
    issues.push(
      issue(
        "cover_note",
        "Never offer a draft, sample letter or template: the letter must be entirely the recommender's.",
      ),
    );
  if (CODE_TOKEN.test(brief.cover_note))
    issues.push(issue("cover_note", "Put codes in cites, not in the text the recommender reads."));
  return issues;
}

const storyBlock = (s: {
  code: string;
  title: string;
  what_happened: string;
  what_they_saw: string;
  your_actions: string[];
  result: string;
  numbers: string[];
  what_they_said: string | null;
  traits: string[];
  cites: string[];
}) =>
  [
    `${s.code} "${s.title}" | traits ${s.traits.join(", ") || "none"} | cites ${s.cites.join(",") || "none"}`,
    `  what happened: ${s.what_happened}`,
    `  what the recommender saw: ${s.what_they_saw}`,
    `  the applicant's actions: ${s.your_actions.join("; ")}`,
    `  result: ${s.result}`,
    s.numbers.length > 0 ? `  numbers: ${s.numbers.join("; ")}` : "",
    s.what_they_said ? `  what the recommender said: "${s.what_they_said}"` : "",
  ]
    .filter(Boolean)
    .join("\n");

/** One R story's fields as plain text, for briefCiteIssues' number check. */
export function lorStoryText(s: Parameters<typeof storyBlock>[0]): string {
  return storyBlock(s);
}

export const lorBrief = defineTask({
  name: "lor.brief",
  agent: "lor.brief",
  input: LorBriefInput,
  output: LorBriefOutput,
  outputName: "LorBriefOutput",
  requires: ["dossier"],
  buildMessages: (input) => {
    const r = input.recommender;
    const a = input.assignment;
    return [
      {
        role: "user",
        content: [
          `Recommender: ${r.ref} | ${r.name} | ${r.relationship}${r.title ? ` | ${r.title}` : ""}${r.organisation ? `, ${r.organisation}` : ""} | known for: ${r.duration ?? "unknown"} | how often: ${r.frequency ?? "unknown"} | knows MBA admissions: ${r.knows_mba}`,
          `Applicant's first name: ${input.applicant_first_name}${input.is_reapplicant ? " (a reapplicant: use new evidence only, LOR-07)" : ""}`,
          `Schools and their questions (answer every question by its id, copying the question exactly):\n${input.schools
            .map(
              (s) =>
                `${s.school_cycle_id} | ${s.school}\n${s.questions.map((q) => `  ${q.id}: ${q.text_verbatim}`).join("\n")}`,
            )
            .join("\n")}`,
          [
            `This recommender's assignment: strengths ${a.strengths.join(", ")}; stories ${a.stories.join(", ")}`,
            ...a.facets.map((f) => `  facet ${f.story}: ${f.facet} (evidence: ${f.evidence})`),
            ...a.avoid.map((v) => `  avoid ${v.story}: ${v.facet} (${v.because}: ${v.where})`),
          ].join("\n"),
          input.others.length > 0
            ? `The other recommenders cover (so this brief complements them):\n${input.others
                .map(
                  (o) =>
                    `${o.ref} | ${o.relationship} | ${o.strengths.join(", ")} | ${o.facets.join("; ")}`,
                )
                .join("\n")}`
            : "",
          untrustedBlock("recommender_stories", input.stories.map(storyBlock).join("\n")),
          input.relationship_note
            ? `How they know the applicant: ${input.relationship_note.summary}${input.relationship_note.chose_you_for ? ` Chose them for: ${input.relationship_note.chose_you_for}` : ""} (cites ${input.relationship_note.cites.join(",") || "none"})`
            : "",
          input.growth
            ? `Feedback arc: ${input.growth.feedback} → ${input.growth.response} → ${input.growth.steps.join("; ")} → ${input.growth.evidence} (cites ${input.growth.cites.join(",") || "none"})`
            : "Feedback arc: none given.",
          input.red_flags.length > 0
            ? `Red flags this recommender can help with:\n${input.red_flags.map((f) => `- ${f.flag}: ${f.how}`).join("\n")}`
            : "",
          `Write ${r.name}'s brief.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];
  },
  check: (output, input, layers) => {
    const others = new Set(input.others.flatMap((o) => o.facets.map(plainText)));
    const issues = briefCiteIssues(output, {
      dossier: layers.dossier ?? "",
      storyCodes: input.stories.map((s) => s.code),
      storyText: Object.fromEntries(input.stories.map((s) => [s.code, storyBlock(s)])),
      questions: input.schools.map((s) => ({
        school_cycle_id: s.school_cycle_id,
        questions: s.questions,
      })),
      assigned: [...input.assignment.stories, ...input.assignment.facets.map((f) => f.story)],
    });
    output.schools.forEach((school, si) =>
      school.questions.forEach((q, qi) =>
        q.talking_points.forEach((p, pi) => {
          if (others.has(plainText(p.facet)))
            issues.push(
              issue(
                `schools.${si}.questions.${qi}.talking_points.${pi}.facet`,
                "Another recommender covers this facet; give this recommender a different side of the story.",
              ),
            );
        }),
      ),
    );
    return issues;
  },
});

/* lor.recommender_assist ----------------------------------------------------------------------- */

/** The assisted answer as one text, paragraphs separated by a blank line. */
export function assistAnswerText(assist: RecommenderAssist): string {
  return (assist.answer?.paragraphs ?? [])
    .map((p) => p.sentences.map((s) => s.text).join(" "))
    .join("\n\n");
}

/**
 * The assistant works only from the recommender's notes (LOR-10, decision 2): every sentence cites
 * a note that exists; "verbatim" is in the cited note word for word; "adapted" keeps at least 60%
 * of its content words from the cited notes; no number or name the notes don't have; no run of six
 * words from the applicant's brief unless the notes have it too; within the question's limit.
 * `allowedNames` are names the notes may leave out (the applicant's first name).
 */
export function assistProvenanceIssues(
  assist: RecommenderAssist,
  notes: readonly { id: string; text: string }[],
  briefPoints: readonly string[],
  limit: LimitRule | null,
  allowedNames: readonly string[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(notes.map((n) => [n.id, n.text]));
  const allNotes = notes.map((n) => n.text).join("\n");
  const noteGrams = grams(allNotes, 6);
  const briefGrams = new Set(briefPoints.flatMap((p) => [...grams(p, 6)]));

  (assist.answer?.paragraphs ?? []).forEach((paragraph, pi) =>
    paragraph.sentences.forEach((sentence, si) => {
      const path = `answer.paragraphs.${pi}.sentences.${si}`;
      const unknown = sentence.notes.filter((id) => !byId.has(id));
      if (sentence.notes.length === 0)
        issues.push(issue(`${path}.notes`, "Cite the note (N#) this sentence comes from."));
      if (unknown.length > 0)
        issues.push(issue(`${path}.notes`, `${unknown.join(", ")} is not one of the notes.`));
      const cited = sentence.notes.map((id) => byId.get(id) ?? "").join("\n");
      if (sentence.kind === "verbatim" && !plainText(cited).includes(plainText(sentence.text)))
        issues.push(
          issue(
            path,
            "Marked verbatim but not in the cited note word for word. Use the note's words exactly, or mark it adapted.",
          ),
        );
      if (sentence.kind === "adapted") {
        const words = contentWords(sentence.text);
        const have = new Set(contentWords(cited));
        const kept = words.filter((w) => have.has(w)).length;
        if (words.length > 0 && kept / words.length < 0.6)
          issues.push(
            issue(
              path,
              "Most of this sentence isn't in the recommender's notes. Keep their words: reorder or join what they wrote, and add nothing of your own.",
            ),
          );
      }
      const numbers = newNumbers(sentence.text, "", allNotes);
      if (numbers.length > 0)
        issues.push(issue(path, `${numbers.join(", ")} is not in the notes. Never add a number.`));
      const names = newNames(sentence.text, allNotes, allowedNames.join("\n"));
      if (names.length > 0)
        issues.push(issue(path, `${names.join(", ")} is not in the notes. Never add a name.`));
      const borrowed = [...grams(sentence.text, 6)].some(
        (g) => briefGrams.has(g) && !noteGrams.has(g),
      );
      if (borrowed)
        issues.push(
          issue(
            path,
            "This uses the applicant's brief's words, which aren't the recommender's. Use only what the notes say.",
          ),
        );
    }),
  );

  if (assist.answer && limit) {
    const used = count(assistAnswerText(assist), limit.kind);
    if (used > limit.value)
      issues.push(
        issue(
          "answer",
          `${used} counted; the question allows ${limitLabel(limit)}. Use fewer of the notes rather than shortening their words.`,
        ),
      );
  }
  assist.outline.forEach((beat, i) => {
    const unknown = beat.your_notes.filter((id) => !byId.has(id));
    if (unknown.length > 0)
      issues.push(
        issue(`outline.${i}.your_notes`, `${unknown.join(", ")} is not one of the notes.`),
      );
  });
  return issues;
}

export const recommenderAssist = defineTask({
  name: "lor.recommender_assist",
  agent: "lor.recommender_assist",
  input: RecommenderAssistInput,
  output: RecommenderAssistOutput,
  outputName: "RecommenderAssistOutput",
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        input.mode === "coach"
          ? "Mode: coach. A school this letter goes to restricts AI help for recommenders, or the recommender chose to write it themselves: give a structure and questions only. answer is null; write no sentences."
          : "Mode: assist. Organise the recommender's own notes into an answer, in their words.",
        `The question (${input.question.limit ? `limit: ${limitLabel(input.question.limit)}` : "no limit"}):\n${input.question.text_verbatim}`,
        `The recommender is the applicant's ${input.relationship}, writing about ${input.applicant_first_name}.`,
        input.voice_card ? `How the recommender writes: ${input.voice_card}` : "",
        untrustedBlock(
          "recommender_notes",
          input.notes.map((n) => `${n.id}: ${n.text}`).join("\n"),
        ),
        input.brief_points.length > 0
          ? untrustedBlock(
              "applicant_brief_context_only",
              `What the applicant's brief mentions (context only: never use these words):\n${input.brief_points.map((p) => `- ${p}`).join("\n")}`,
            )
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ],
  check: (output, input) => {
    const issues: ValidationIssue[] = [];
    if (input.mode === "coach") {
      if (output.answer !== null)
        issues.push(
          issue(
            "answer",
            "Coach mode writes no sentences: set answer to null and give the outline.",
          ),
        );
      if (output.outline.length === 0)
        issues.push(
          issue(
            "outline",
            "Give a structure: the beats, the notes under each, questions to answer.",
          ),
        );
    } else if (output.answer === null || output.answer.paragraphs.length === 0)
      issues.push(issue("answer", "Organise the notes into an answer."));
    issues.push(
      ...assistProvenanceIssues(output, input.notes, input.brief_points, input.question.limit, [
        input.applicant_first_name,
      ]),
    );
    return issues;
  },
});
