// The chat beside each school deliverable (`chat.revise`) and the Résumé page's writer
// (`resume.write`). The rules a JSON Schema cannot express are checked here and get the single
// repair attempt (§8.4 step 6): an edit names a field that exists, fits its limit, and a résumé
// bullet carries no number that is in neither the applicant's material nor their dossier.

import type { ValidationIssue } from "../errors";
import { untrustedBlock } from "../request";
import { ChatReviseInput, ChatReviseOutput, ResumeWriteInput, ResumeWriteOutput } from "../schemas";
import { defineTask } from "./define";
import { newNumbers } from "./forms";

const issue = (path: string, message: string): ValidationIssue => ({ path, message });

const KIND_LABEL = {
  form_entries: "application form entries",
  video_points: "video essay talking points",
  brief_points: "a recommender brief",
} as const;

function historyBlock(history: readonly { role: string; text: string }[]): string {
  if (history.length === 0) return "";
  return `Earlier in this chat (oldest first):\n${history
    .map((h) => `${h.role === "you" ? "Applicant" : "You"}: ${h.text}`)
    .join("\n")}`;
}

/* chat.revise ---------------------------------------------------------------------------------- */

export const chatRevise = defineTask({
  name: "chat.revise",
  agent: "chat.revise",
  input: ChatReviseInput,
  output: ChatReviseOutput,
  outputName: "ChatReviseOutput",
  requires: ["dossier"],
  buildMessages: (input) => [
    {
      role: "user",
      content: [
        `You are editing ${KIND_LABEL[input.kind]}: ${input.title}.`,
        input.context ? `Rules and context:\n${input.context}` : "",
        `Fields (id | label | limit | current text):\n${input.fields
          .map(
            (f) =>
              `${f.id} | ${f.label} | ${f.limit_chars ? `${f.limit_chars} characters` : "no limit"} | ${f.text ? JSON.stringify(f.text) : "(empty)"}`,
          )
          .join("\n")}`,
        historyBlock(input.history),
        untrustedBlock("applicant_request", input.instruction),
        "Do what the applicant asked. Return only the fields you changed.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ],
  check: (output, input) => {
    const issues: ValidationIssue[] = [];
    const fields = new Map(input.fields.map((f) => [f.id, f]));
    const seen = new Set<string>();
    output.edits.forEach((edit, i) => {
      const at = `edits.${i}`;
      const field = fields.get(edit.id);
      if (!field) {
        issues.push(issue(`${at}.id`, `No field "${edit.id}": edit only the listed ids`));
        return;
      }
      if (seen.has(edit.id)) issues.push(issue(`${at}.id`, `"${edit.id}" is edited twice`));
      seen.add(edit.id);
      if (field.limit_chars && edit.text.length > field.limit_chars)
        issues.push(
          issue(
            `${at}.text`,
            `${edit.text.length} characters; "${edit.id}" allows ${field.limit_chars}. Shorten it.`,
          ),
        );
    });
    return issues;
  },
});

/* resume.write --------------------------------------------------------------------------------- */

function resumeText(doc: ResumeWriteInput["current"]): string {
  if (!doc) return "";
  return [
    doc.header.name ?? "",
    ...(doc.header.lines ?? []),
    ...doc.sections.flatMap((s) => [
      s.heading,
      ...s.roles.flatMap((r) => [
        [r.organisation, r.title, r.dates, r.location].filter(Boolean).join(" | "),
        ...r.bullets.map((b) => b.text),
      ]),
      ...(s.lines ?? []),
    ]),
  ].join("\n");
}

export const resumeWrite = defineTask({
  name: "resume.write",
  agent: "resume.write",
  input: ResumeWriteInput,
  output: ResumeWriteOutput,
  outputName: "ResumeWriteOutput",
  requires: ["dossier"],
  buildMessages: (input) => {
    const narrative = input.narrative ?? { goal: "", thread: "", notes: "" };
    return [
      {
        role: "user",
        content: [
          `The applicant's narrative:\nGoal after the MBA: ${narrative.goal || "(not given; infer it from the dossier)"}\nThe thread to remember: ${narrative.thread || "(not given; choose the strongest from the dossier)"}\nNotes: ${narrative.notes || "(none)"}`,
          input.page_limit
            ? `Their schools ask for at most ${input.page_limit} page${input.page_limit === 1 ? "" : "s"}.`
            : "Keep it to one page.",
          input.current
            ? `The résumé as it stands (JSON; keep ids stable for what you keep):\n${JSON.stringify(input.current)}`
            : "",
          input.pasted_cv ? untrustedBlock("pasted_cv", input.pasted_cv) : "",
          historyBlock(input.history ?? []),
          input.instruction
            ? untrustedBlock("applicant_request", input.instruction)
            : input.current
              ? "Rebuild the résumé so it tells the narrative above."
              : input.pasted_cv
                ? "Rewrite this CV into an MBA résumé that tells the narrative above."
                : "Build the applicant's MBA résumé from their dossier, telling the narrative above.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];
  },
  check: (output, input, layers) => {
    const issues: ValidationIssue[] = [];
    const known = `${resumeText(input.current ?? null)}\n${input.pasted_cv ?? ""}\n${input.instruction ?? ""}`;
    const dossier = layers.dossier ?? "";
    const ids = new Set<string>();
    const unique = (id: string, path: string) => {
      if (ids.has(id)) issues.push(issue(path, `Duplicate id "${id}"`));
      ids.add(id);
    };
    output.resume.sections.forEach((section, si) => {
      unique(section.id, `resume.sections.${si}.id`);
      section.roles.forEach((role, ri) => {
        unique(role.id, `resume.sections.${si}.roles.${ri}.id`);
        role.bullets.forEach((bullet, bi) => {
          const at = `resume.sections.${si}.roles.${ri}.bullets.${bi}`;
          unique(bullet.id, `${at}.id`);
          const invented = newNumbers(bullet.text, known, dossier);
          if (invented.length > 0)
            issues.push(
              issue(
                `${at}.text`,
                `${invented.join(", ")} is in neither the applicant's material nor the dossier: never invent a number. Drop it and add an ask instead.`,
              ),
            );
        });
      });
    });
    return issues;
  },
});
