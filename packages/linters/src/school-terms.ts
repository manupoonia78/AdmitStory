// School-specific details (§8.7 "School specifics": a course, professor, club, centre, trek,
// statistic or event). Two kinds of evidence:
//   - pack terms: names the pack itself lists (courses, centres, clubs…), passed in by the caller.
//     These always need a verified K source.
//   - shape matches: capitalised names ending in Club, Center, Lab, Trek…, "Professor X", and
//     class statistics. These could also be the applicant's own past ("the Riverside Robotics
//     Club" at their college), so they need a K source only when the sentence cites nothing
//     from the applicant's own file (F/S/L/C/P codes).

import { escapeRegExp } from "./text";

export interface SchoolTermMatch {
  text: string;
  index: number;
  /** "pack" when the term comes from the pack; "shape" when only its shape says so. */
  via: "pack" | "shape";
}

const INSTITUTION_NOUNS =
  "Club|Center|Centre|Institute|Initiative|Lab|Laboratory|Trek|Treks|Fellowship|Fellows|Programme|Program|Conference|Summit|Challenge|Competition|Fund|Society|Association|Seminar|Practicum|Immersion|Forum|Network|Accelerator|Incubator|Studio|Clinic";

const SHAPES: RegExp[] = [
  /(?<![\p{L}])(?:Professor|Prof\.?|Dean)\s+\p{Lu}[\p{L}'’-]+/gu,
  new RegExp(
    `(?<![\\p{L}])(?:\\p{Lu}[\\p{L}&'’-]*\\s+){1,4}(?:${INSTITUTION_NOUNS})(?![\\p{L}])`,
    "gu",
  ),
  /\b\d+(?:\.\d+)?\s?(?:%|percent|per\s+cent)\s+of\s+(?:the\s+|each\s+|every\s+)?(?:class|cohort|students|graduates|alumni)\b/giu,
  /\b(?:median|average)\s+(?:GMAT|GRE|GPA|salary|base\s+salary|starting\s+salary|years\s+of\s+experience)\b/giu,
  /\bemployment\s+report\b/giu,
];

const BARE_NOUN = new RegExp(`^(?:${INSTITUTION_NOUNS})$`, "u");

const LEADING_STOPWORDS =
  /^(?:The|A|An|Our|My|Their|His|Her|This|That|At|In|On|With|From|Through)\s+/u;

export function findSchoolTerms(
  text: string,
  packTerms: readonly string[] = [],
): SchoolTermMatch[] {
  const matches: SchoolTermMatch[] = [];
  for (const term of packTerms) {
    const trimmed = term.trim();
    if (trimmed.length < 3) continue;
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`,
      "giu",
    );
    for (const m of text.matchAll(pattern))
      matches.push({ text: m[0], index: m.index, via: "pack" });
  }
  for (const shape of SHAPES) {
    for (const m of text.matchAll(shape)) {
      const lead = LEADING_STOPWORDS.exec(m[0]);
      const index = m.index + (lead ? lead[0].length : 0);
      const value = lead ? m[0].slice(lead[0].length) : m[0];
      // "The Fund" or "Our Studio" alone names nothing in particular.
      if (BARE_NOUN.test(value)) continue;
      if (matches.some((x) => index >= x.index && index < x.index + x.text.length)) continue;
      matches.push({ text: value, index, via: "shape" });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}
