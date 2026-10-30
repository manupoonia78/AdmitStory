// The compact dossier (spec §8.2 L2): terse, ID-addressed, no prose padding. This is the only
// thing any drafting agent ever learns about the applicant, so three rules are enforced here in
// code rather than in a prompt, where a model could get them wrong:
//
//   1. Nothing whose consent_to_use is false enters the snapshot (§8.7, §14.3). Golden lines,
//      people and brand evidence belonging only to withheld stories go with them. The count of
//      withheld items is stated, so an agent knows material exists and can ask for it.
//   2. A person's name appears only when may_name is true; otherwise their role stands in (§8.7).
//   3. A fact with an approved phrasing carries it, because every draft must use that phrasing
//      (§5.3a, and the factMismatch linter in §8.8 enforces it downstream).
//
// The Consolidator decides what the text says (merges, statuses, summaries, brand, voice card);
// this function decides how it is laid out and guarantees the ceiling. Output is deterministic:
// the same input always compiles byte-for-byte identically, so the 5-minute cache keeps hitting
// across a kit pipeline (§8.2).

import { sortCodes } from "../codes";
import { lensLetters } from "../lenses";
import { DOSSIER_TOKEN_BUDGET, estimateTokens } from "./tokens";
import type { DossierFact, DossierInput, DossierStory, StoryStatus } from "./types";

export interface CompiledDossier {
  text: string;
  tokenCount: number;
  /** What went in, for `dossier_snapshots.built_from` and for the Dossier UI's provenance. */
  builtFrom: {
    factCodes: string[];
    storyCodes: string[];
    lineCodes: string[];
    withheldStories: number;
    withheldFacts: number;
    /**
     * Stories cut back to fit the budget: which fields went, or `whole_story` when the story
     * itself was left out. Nothing here is a consent decision — those are the withheld counts.
     */
    trimmed: { code: string; dropped: string[] }[];
  };
}

export interface CompileOptions {
  /** Defaults to §8.5.3's 10K target. */
  tokenBudget?: number;
}

/* Ordering ----------------------------------------------------------------------------------- */

const STATUS_RANK: Record<StoryStatus, number> = { confirmed: 0, partial: 1, unconfirmed: 2 };

/**
 * Which stories matter most, for trimming. Confirmed material first (only confirmed stories can
 * lead a deliverable), then the ones that prove more lenses, then by code so the order is stable.
 */
function byPriority(a: DossierStory, b: DossierStory): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (byStatus !== 0) return byStatus;
  const byLenses = b.lenses.length - a.lenses.length;
  if (byLenses !== 0) return byLenses;
  return a.code.localeCompare(b.code);
}

/* Lines -------------------------------------------------------------------------------------- */

function applicantLine(input: DossierInput): string {
  const { applicant } = input;
  const parts = [`APPLICANT  ${applicant.handle}`];
  const target = [applicant.programType, applicant.targetIntake].filter(Boolean).join(" ");
  if (target) parts.push(`target: ${target}`);
  if (applicant.country) parts.push(`country: ${applicant.country}`);
  if (applicant.yearsExperience != null) parts.push(`yrs_exp: ${applicant.yearsExperience}`);
  if (applicant.test) parts.push(`test: ${applicant.test.type} ${applicant.test.score}`);
  if (applicant.gpa) parts.push(`gpa: ${applicant.gpa.value}/${applicant.gpa.scale}`);
  return parts.join(" | ");
}

function factLine(fact: DossierFact): string {
  const head = `${fact.code} ${fact.key} = ${JSON.stringify(fact.value)}`;
  const note = fact.note ? ` (${fact.note})` : "";
  const flags: string[] = [fact.status];
  if (fact.approvedPhrasing)
    flags.push(`approved phrasing: ${JSON.stringify(fact.approvedPhrasing)}`);
  if (fact.status === "conflict" && fact.conflict)
    flags.push(`also stated: ${JSON.stringify(fact.conflict.otherValue)}`);
  if (fact.sensitivity === "sensitive") flags.push("sensitive");
  return `${head}${note} [${flags.join("; ")}]`;
}

/** A person as the drafting engine may refer to them: name only with may_name (§8.7). */
function personRef(person: DossierStory["people"][number]): string {
  return person.mayName
    ? `${person.code} ${person.name} (${person.roleInLife}; may_name=yes)`
    : `${person.code} ${person.roleInLife} (may_name=no)`;
}

type StoryField = "stakes" | "refl" | "extra_lines";

function storyBlock(story: DossierStory, dropped: readonly StoryField[]): string {
  const lines: string[] = [];
  const header = [
    `${story.code} ${JSON.stringify(story.nickname)}`,
    `${story.context} ${story.era}`,
    `lenses ${lensLetters(story.lenses) || "—"}`,
    `traits ${story.traits.length > 0 ? story.traits.join(", ") : "—"}`,
    story.status,
  ];
  lines.push(header.join(" | "));
  lines.push(`  sit: ${story.situation}`);
  if (story.stakes && !dropped.includes("stakes")) lines.push(`  stk: ${story.stakes}`);
  if (story.actions.length > 0) lines.push(`  act: ${story.actions.join("; ")}`);
  if (story.result) lines.push(`  res: ${story.result}`);
  if (story.reflection && !dropped.includes("refl")) lines.push(`  refl: ${story.reflection}`);
  const keptLines = dropped.includes("extra_lines") ? story.lines.slice(0, 2) : story.lines;
  if (keptLines.length > 0)
    lines.push(
      `  lines: ${keptLines
        .map((line) => `${line.code} ${JSON.stringify(line.text)}`)
        .join(" | ")}`,
    );
  if (story.people.length > 0) lines.push(`  people: ${story.people.map(personRef).join(" | ")}`);
  lines.push(`  used: ${story.usedIn.length > 0 ? story.usedIn.join(", ") : "none"}`);
  return lines.join("\n");
}

function render(
  input: DossierInput,
  included: readonly DossierStory[],
  facts: readonly DossierFact[],
  dropped: ReadonlyMap<string, readonly StoryField[]>,
  omitted: readonly string[],
  withheld: { stories: number; facts: number },
): string {
  const sections: string[] = [applicantLine(input)];

  sections.push(["FACTS", ...facts.map(factLine)].join("\n"));

  const storyBlocks = included.map((story) => storyBlock(story, dropped.get(story.code) ?? []));
  sections.push(["STORIES", ...storyBlocks].join("\n"));

  const includedCodes = new Set(included.map((story) => story.code));
  const brand = input.brand
    .map((entry) => {
      const stories = entry.stories.filter((storyCode) => includedCodes.has(storyCode));
      return stories.length > 0 ? `${entry.trait} (${sortCodes(stories).join(",")})` : undefined;
    })
    .filter((entry): entry is string => entry !== undefined);
  if (brand.length > 0) sections.push(`BRAND  ${brand.join(" | ")}`);

  if (input.voice?.card.trim()) sections.push(`VOICE  ${input.voice.card.trim()}`);

  if (input.goals) {
    const goals = [
      input.goals.shortTerm ? `ST: ${input.goals.shortTerm}` : undefined,
      input.goals.longTerm ? `LT: ${input.goals.longTerm}` : undefined,
      input.goals.planB ? `planB: ${input.goals.planB}` : undefined,
    ].filter(Boolean);
    if (goals.length > 0) sections.push(`GOALS  ${goals.join(" | ")}`);
  }

  for (const contact of input.engagement ?? []) {
    const who = contact.mayName
      ? `${contact.code} ${contact.name} (${contact.role})`
      : `${contact.code} ${contact.role}`;
    sections.push(
      `ENGAGEMENT(this school) ${who} taught: ${JSON.stringify(contact.taught)} [may_name=${
        contact.mayName ? "yes" : "no"
      }]`,
    );
  }

  const withheldTotal = withheld.stories + withheld.facts;
  if (withheldTotal > 0)
    sections.push(
      `SENSITIVE(excluded unless consent): ${withheldTotal} item${
        withheldTotal === 1 ? "" : "s"
      } withheld`,
    );

  const shortened = [...dropped.keys()];
  if (shortened.length > 0 || omitted.length > 0) {
    const parts: string[] = [];
    if (shortened.length > 0) parts.push(`shortened ${sortCodes(shortened).join(",")}`);
    if (omitted.length > 0) parts.push(`omitted ${sortCodes(omitted).join(",")}`);
    sections.push(`TRIMMED(to fit budget; ask if a detail is missing): ${parts.join(" | ")}`);
  }

  return `${sections.join("\n")}\n`;
}

/* Compile ------------------------------------------------------------------------------------ */

/** The order the compiler gives up detail in when the snapshot is over budget. */
const TRIM_STEPS: readonly StoryField[] = ["stakes", "refl", "extra_lines"];

export function compileDossier(input: DossierInput, options: CompileOptions = {}): CompiledDossier {
  const budget = options.tokenBudget ?? DOSSIER_TOKEN_BUDGET;

  // Rule 1: consent decides inclusion, before anything else happens.
  const facts = input.facts.filter((fact) => fact.consentToUse);
  const withheld = {
    facts: input.facts.length - facts.length,
    stories: input.stories.filter((story) => !story.consentToUse).length,
  };
  const candidates = [...input.stories.filter((story) => story.consentToUse)].sort(byPriority);

  const dropped = new Map<string, StoryField[]>();
  const omitted: string[] = [];
  let included = candidates;
  let text = render(input, included, facts, dropped, omitted, withheld);
  const overBudget = () => estimateTokens(text) > budget;

  // Give up detail from the least important stories first, then whole stories, until it fits.
  // Facts are never trimmed: they are the single source of truth every draft is checked against.
  for (const step of TRIM_STEPS) {
    if (!overBudget()) break;
    for (const story of [...included].reverse()) {
      if (!overBudget()) break;
      dropped.set(story.code, [...(dropped.get(story.code) ?? []), step]);
      text = render(input, included, facts, dropped, omitted, withheld);
    }
  }
  while (overBudget() && included.length > 1) {
    const last = included.at(-1);
    if (!last) break;
    included = included.slice(0, -1);
    dropped.delete(last.code);
    omitted.push(last.code);
    text = render(input, included, facts, dropped, omitted, withheld);
  }

  return {
    text,
    tokenCount: estimateTokens(text),
    builtFrom: {
      factCodes: facts.map((fact) => fact.code),
      storyCodes: included.map((story) => story.code),
      lineCodes: included.flatMap((story) => {
        const fields = dropped.get(story.code) ?? [];
        const lines = fields.includes("extra_lines") ? story.lines.slice(0, 2) : story.lines;
        return lines.map((line) => line.code);
      }),
      withheldStories: withheld.stories,
      withheldFacts: withheld.facts,
      trimmed: [
        ...[...dropped.entries()].map(([code, fields]) => ({ code, dropped: [...fields] })),
        ...omitted.map((code) => ({ code, dropped: ["whole_story"] })),
      ],
    },
  };
}
