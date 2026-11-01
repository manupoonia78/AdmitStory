// The Form Advisor and the Résumé Reviewer (spec §5.10, §8.5.12; canon A9 forms, A10 resume).
// Every recommendation carries a reason and every fact a source (§8.5.12). The rules below are the
// ones a JSON Schema cannot express; a violation gets the single repair attempt (§8.4 step 6).
// Field limits are not among them: the app fits entries to the portal's count after the call
// (fitFormEntries), so one entry a few characters over never fails the whole section.

import { extractQuantities, type DraftDoc } from "@admitstory/linters";
import { FORM_ENTRY_RECOMMENDATIONS, unresolvedCites } from "@admitstory/shared/kit";
import type { ValidationIssue } from "../errors";
import { untrustedBlock } from "../request";
import {
  FormsAdviseInput,
  FormsAdviseOutput,
  ResumeReviewInput,
  ResumeReviewOutput,
} from "../schemas";
import { defineTask } from "./define";
import { limitLabel } from "./kit-writing";
import { draftProvenanceIssues, materialFor } from "./provenance";

const issue = (path: string, message: string): ValidationIssue => ({ path, message });

/* forms.advise ------------------------------------------------------------------------------- */

export const formsAdvise = defineTask({
  name: "forms.advise",
  agent: "forms.advise",
  input: FormsAdviseInput,
  output: FormsAdviseOutput,
  outputName: "FormsAdviseOutput",
  requires: ["schoolPack", "dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `Mode: ${input.mode}${input.mode === "coach" ? " (this school does not allow AI-written answers: every entry is null)" : ""}`,
        `Form sections:\n${input.sections
          .map(
            (s) =>
              `${s.key} | ${JSON.stringify(s.label)} | limit per entry: ${limitLabel(s.limit)} | entries at most: ${s.item_count_max ?? "no maximum"}`,
          )
          .join("\n")}`,
        input.deliverables.length > 0
          ? `What the essays and short answers carry (key | title | primary story):\n${input.deliverables
              .map((d) => `${d.key} | ${d.title} | ${d.primary_story ?? "none"}`)
              .join("\n")}`
          : "",
        "Advise on every form section.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ],
  check: (output, input, layers) => {
    const issues: ValidationIssue[] = [];
    const material = materialFor(layers);
    const sections = new Map(input.sections.map((s) => [s.key, s]));
    const deliverables = new Set(input.deliverables.map((d) => d.key));
    const seen = new Set<string>();

    output.sections.forEach((section, si) => {
      const at = `sections.${si}`;
      const spec = sections.get(section.section_key);
      if (!spec) {
        issues.push(issue(`${at}.section_key`, `Unknown form section "${section.section_key}"`));
        return;
      }
      if (seen.has(section.section_key))
        issues.push(issue(`${at}.section_key`, `"${section.section_key}" appears twice`));
      seen.add(section.section_key);

      const ids = new Map(section.items.map((item) => [item.id, item]));
      if (ids.size !== section.items.length)
        issues.push(issue(`${at}.items`, "Item ids must be unique within a section"));

      section.items.forEach((item, ii) => {
        const where = `${at}.items.${ii}`;
        const enters = FORM_ENTRY_RECOMMENDATIONS.includes(item.recommendation);
        if (item.recommendation === "combine_with") {
          const partner = item.combine_with ? ids.get(item.combine_with) : undefined;
          if (!partner || partner.id === item.id)
            issues.push(
              issue(
                `${where}.combine_with`,
                "Name the other item in this section it combines with",
              ),
            );
        } else if (item.combine_with !== null)
          issues.push(issue(`${where}.combine_with`, "Only a combine_with item names a partner"));

        if (item.recommendation === "move_to_essay") {
          if (!item.move_to || !deliverables.has(item.move_to))
            issues.push(issue(`${where}.move_to`, "Name the essay's deliverable key it moves to"));
        } else if (item.move_to !== null)
          issues.push(issue(`${where}.move_to`, "Only a move_to_essay item names a deliverable"));

        if (input.mode === "coach" && item.entry !== null)
          issues.push(
            issue(
              `${where}.entry`,
              "Coach mode: this school does not allow AI-written answers. Set entry to null; the reason, pointers and cites stay.",
            ),
          );
        if (input.mode === "draft") {
          const partnerHasEntry =
            item.recommendation === "combine_with" &&
            !!item.combine_with &&
            ids.get(item.combine_with)?.entry !== null;
          if (enters && item.entry === null && !partnerHasEntry)
            issues.push(
              issue(`${where}.entry`, "Write the entry for an item that goes in the form"),
            );
          if (!enters && item.entry !== null)
            issues.push(issue(`${where}.entry`, "An item that leaves the form has no entry"));
        }
      });

      const entries = section.items.filter((item) => item.entry !== null).length;
      const placed = section.items.filter(
        (item) => item.recommendation === "lead_with" || item.recommendation === "include",
      ).length;
      const max = spec.item_count_max;
      if (max !== null && Math.max(entries, placed) > max)
        issues.push(
          issue(
            `${at}.items`,
            `${Math.max(entries, placed)} entries; the form takes at most ${max}. Choose, and recommend leave_out (or combine) for the rest, with the reason.`,
          ),
        );
    });

    for (const key of sections.keys())
      if (!seen.has(key)) issues.push(issue("sections", `Advise on the "${key}" section too`));

    issues.push(...unresolvedCites(output, material.known));

    // Every entry is held to the same provenance rules as a draft sentence (§8.7).
    const doc: DraftDoc = {
      paragraphs: output.sections.flatMap((section) =>
        section.items.flatMap((item) =>
          item.entry
            ? [
                {
                  id: `${section.section_key}/${item.id}`,
                  sentences: [
                    {
                      text: item.entry.text,
                      kind: "composed" as const,
                      sources: item.entry.sources,
                    },
                  ],
                },
              ]
            : [],
        ),
      ),
    };
    const paths = new Map<string, string>();
    output.sections.forEach((section, si) =>
      section.items.forEach((item, ii) =>
        paths.set(`${section.section_key}/${item.id}`, `sections.${si}.items.${ii}.entry`),
      ),
    );
    if (doc.paragraphs.length > 0)
      for (const found of draftProvenanceIssues(doc, material, "")) {
        const index = /^paragraphs\.(\d+)/.exec(found.path)?.[1];
        const id = index === undefined ? undefined : doc.paragraphs[Number(index)]?.id;
        issues.push({ ...found, path: (id && paths.get(id)) ?? "sections" });
      }
    return issues;
  },
});

/* resume.review ------------------------------------------------------------------------------ */

/** Whitespace, quotes, dashes and bullet glyphs ignored: for "word for word from the résumé". */
export function normaliseResume(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[•▪◦●■·*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const quantitiesOf = (text: string) =>
  extractQuantities(text.replace(/\[\?\d{1,2}\]/g, " ")).filter((q) => q.kind !== "year");

/** Percentages and money compare only with their own kind; counts, ranges and "50+" with each other. */
const family = (kind: string) => (kind === "percent" || kind === "money" ? kind : "count");

/** Numbers in a rewrite that are in neither the original bullet nor the applicant's dossier. */
export function newNumbers(rewrite: string, original: string, dossier: string): string[] {
  const known = [...quantitiesOf(original), ...quantitiesOf(dossier)];
  return quantitiesOf(rewrite)
    .filter(
      (q) =>
        !known.some((k) => family(k.kind) === family(q.kind) && Math.abs(k.value - q.value) < 1e-9),
    )
    .map((q) => q.text);
}

const PROPER = /(?<![.!?]\s|^)\b\p{Lu}[\p{L}&'-]+(?:\s+\p{Lu}[\p{L}&'-]+)*/gu;

/** Capitalised names in a rewrite that appear in neither the original nor the dossier. */
export function newNames(rewrite: string, original: string, dossier: string): string[] {
  const haystack = `${original}\n${dossier}`.toLowerCase();
  return (
    [...rewrite.matchAll(PROPER)]
      .map((m) => m[0])
      // Short acronyms (ICU, SQL, P&L) are vocabulary, not claims; translating jargon may add one.
      .filter((name) => !/^[\p{Lu}&]{2,5}$/u.test(name))
      .filter((name) => !haystack.includes(name.toLowerCase()))
  );
}

export const resumeReview = defineTask({
  name: "resume.review",
  agent: "resume.review",
  input: ResumeReviewInput,
  output: ResumeReviewOutput,
  outputName: "ResumeReviewOutput",
  requires: ["dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        untrustedBlock("resume", input.resume_text),
        input.page_limit
          ? `The applicant's schools ask for at most ${input.page_limit} page${input.page_limit === 1 ? "" : "s"}.`
          : "",
        "Review this résumé for an MBA application.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ],
  check: (output, input, layers) => {
    const issues: ValidationIssue[] = [];
    const source = normaliseResume(input.resume_text);
    const dossier = layers.dossier ?? "";
    const material = materialFor(layers);
    const verbatim = (value: string | null, path: string, what: string) => {
      if (value !== null && !source.includes(normaliseResume(value)))
        issues.push(issue(path, `${what} is not in the résumé word for word: copy it exactly`));
    };

    if (output.header.name) verbatim(output.header.name, "header.name", "The name");
    output.header.lines.forEach((line, i) => verbatim(line, `header.lines.${i}`, "This line"));

    const ids = new Set<string>();
    const unique = (id: string, path: string) => {
      if (ids.has(id)) issues.push(issue(path, `Duplicate id "${id}"`));
      ids.add(id);
    };
    const sectionIds = new Set(output.sections.map((s) => s.id));
    output.sections.forEach((section, si) => {
      const at = `sections.${si}`;
      unique(section.id, `${at}.id`);
      verbatim(section.heading, `${at}.heading`, "The heading");
      section.lines.forEach((line, li) => verbatim(line, `${at}.lines.${li}`, "This line"));
      section.roles.forEach((role, ri) => {
        const r = `${at}.roles.${ri}`;
        unique(role.id, `${r}.id`);
        verbatim(role.organisation, `${r}.organisation`, "The organisation");
        verbatim(role.title, `${r}.title`, "The title");
        verbatim(role.dates, `${r}.dates`, "The dates");
        verbatim(role.location, `${r}.location`, "The location");
        role.bullets.forEach((bullet, bi) => {
          const b = `${r}.bullets.${bi}`;
          unique(bullet.id, `${b}.id`);
          verbatim(bullet.original, `${b}.original`, "The original bullet");
          if (!bullet.rewrite) return;
          const marks = [...bullet.rewrite.text.matchAll(/\[\?(\d{1,2})\]/g)].map((m) =>
            Number(m[1]),
          );
          const expected = bullet.rewrite.needs.map((_, i) => i + 1);
          if (marks.join(",") !== expected.join(","))
            issues.push(
              issue(
                `${b}.rewrite`,
                `Placeholders must be [?1]…[?${expected.length}] in order, one per need (found ${marks.length})`,
              ),
            );
          const numbers = newNumbers(bullet.rewrite.text, bullet.original, dossier);
          if (numbers.length > 0)
            issues.push(
              issue(
                `${b}.rewrite.text`,
                `${numbers.join(", ")} is in neither the bullet nor the dossier. Never invent a number: use a placeholder [?n] with a need asking for it.`,
              ),
            );
          const names = newNames(bullet.rewrite.text, bullet.original, dossier);
          if (names.length > 0)
            issues.push(
              issue(
                `${b}.rewrite.text`,
                `${names.join(", ")} is in neither the bullet nor the dossier. Don't add names, tools or places the applicant didn't give.`,
              ),
            );
        });
      });
    });

    const order = output.section_order.order;
    if (new Set(order).size !== order.length || order.some((id) => !sectionIds.has(id)))
      issues.push(issue("section_order.order", "List each section id once, and only real ones"));

    issues.push(...unresolvedCites(output, material.known));
    return issues;
  },
});
