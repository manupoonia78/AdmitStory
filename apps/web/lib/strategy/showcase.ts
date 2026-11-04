// The free preview's showcase (Manu, 4 Nov 2026): what the school's pack holds and how we position
// for it, readable before the applicant has told us a single story. Pure, from the published pack
// plus the worked example in ./showcase-stories. Only verified pack items are shown (the rule in
// ./pack); coaching lines rewritten from third-party references are shown as ours, never sourced
// to the reference.

import type { PackItem, SchoolPack } from "@admitstory/kb/types";
import { packDeliverables } from "./deliverables";
import { citationFor } from "./pack";
import { SHOWCASE_STORIES, type ShowcaseStory } from "./showcase-stories";

export interface ShowcaseView {
  schoolName: string;
  /** What the school says it looks for, each with the page it said it on. */
  looksFor: { text: string; source: string | null }[];
  /** The school's values as short phrases. */
  values: string[];
  /** What the kit drafts: every written answer, with its limit and the prompt. */
  drafts: { key: string; title: string; limit: string | null; prompt: string }[];
  /** The rest of the pack, one line each: form, recommenders, résumé, interview. */
  alsoIn: string[];
  angles: string[];
  avoid: string[];
  story: ShowcaseStory | null;
}

const verified = (item: Pick<PackItem, "verified_at">) => Boolean(item.verified_at);

/** "Who are we looking for?" from "HEC Paris MBA: Who are we looking for?". */
function sourceLabel(pack: SchoolPack, item: PackItem): string | null {
  const source = pack.sources.find((s) => item.source_ids.includes(s.id));
  if (!source || (source.type !== "official" && source.type !== "adcom")) return null;
  if (!citationFor(pack, item)) return null;
  const title = source.title.replace(/\s*\([^)]*\)\s*$/, "");
  const colon = title.indexOf(": ");
  return colon >= 0 ? title.slice(colon + 2) : title;
}

/** The prompt cut at a sentence or word boundary near `max` characters. */
function clip(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = cut.lastIndexOf(". ");
  if (stop > max * 0.6) return cut.slice(0, stop + 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function showcaseView(input: {
  slug: string | null;
  schoolName: string;
  pack: SchoolPack;
  isReapplicant: boolean;
}): ShowcaseView {
  const { pack, schoolName } = input;
  const app = pack.application;
  const deliverables = packDeliverables(pack, input.isReapplicant);

  const alsoIn: string[] = [];
  const forms = app.form_sections.filter(verified);
  if (forms.length > 0)
    alsoIn.push(
      `The application form: ${forms.length} written ${forms.length === 1 ? "section" : "sections"} advised field by field`,
    );
  if (app.recommendations && verified(app.recommendations))
    alsoIn.push(
      `A brief for each of your ${app.recommendations.count} recommenders, on ${schoolName}'s own questions`,
    );
  if (app.resume && verified(app.resume))
    alsoIn.push(`A résumé pass to ${schoolName}'s rules (${app.resume.page_limit} pages at most)`);
  const interview = pack.interview?.format_notes.find(verified);
  if (interview) alsoIn.push(`How the interview works: ${clip(interview.text, 200)}`);

  return {
    schoolName,
    looksFor: pack.values.stated
      .filter(verified)
      .slice(0, 4)
      .map((item) => ({ text: item.text, source: sourceLabel(pack, item) })),
    values: pack.values.trait_map.map((entry) => entry.school_value).slice(0, 6),
    drafts: deliverables
      .filter((d) => d.drafted)
      .map((d) => ({
        key: d.key,
        title: d.title,
        limit: d.limit,
        prompt: clip(d.prompt),
      })),
    alsoIn,
    angles: pack.angles_that_work
      .filter(verified)
      .slice(0, 4)
      .map((a) => a.text),
    avoid: pack.avoid
      .filter(verified)
      .slice(0, 4)
      .map((a) => a.text),
    story: input.slug ? (SHOWCASE_STORIES[input.slug] ?? null) : null,
  };
}
