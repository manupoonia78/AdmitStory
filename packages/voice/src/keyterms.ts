import { DEEPGRAM } from "./config";

// Keyterm prompting for dictation (spec §7.5): the words a general model is most likely to get
// wrong and the applicant most cares about. In priority order, because Deepgram caps the total:
//  1. the applicant's own employers and the people in their stories — names only, nothing about
//     who they are or what happened (nothing sensitive leaves in a URL);
//  2. common MBA terms;
//  3. the seed schools (Appendix H), in the spec's order.
// Phase 3 can put the applicant's chosen schools ahead of the rest once user_schools exists.

export const MBA_TERMS = [
  "MBA",
  "GMAT",
  "GRE",
  "Executive Assessment",
  "TOEFL",
  "IELTS",
  "GPA",
  "post-MBA",
  "admissions committee",
  "recommender",
  "short-term goal",
  "long-term goal",
] as const;

export interface KeytermSources {
  employers?: readonly string[];
  people?: readonly string[];
  /** School names as the spec writes them; a parenthetical is dropped. */
  schools?: readonly string[];
}

/**
 * Deepgram treats commas and semicolons as literal text, not separators, so a term keeps only
 * letters, digits, spaces and the punctuation names actually use.
 */
export function cleanKeyterm(raw: string): string | null {
  const term = raw
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^\p{L}\p{N}\p{M}\s.&'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (term.length < 2 || term.length > DEEPGRAM.maxKeytermLength) return null;
  return term;
}

export function buildKeyterms({
  employers = [],
  people = [],
  schools = [],
}: KeytermSources): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  let chars = 0;
  for (const raw of [...employers, ...people, ...MBA_TERMS, ...schools]) {
    if (terms.length >= DEEPGRAM.maxKeyterms) break;
    const term = cleanKeyterm(raw);
    if (!term) continue;
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    if (chars + term.length > DEEPGRAM.maxKeytermChars) continue;
    seen.add(key);
    terms.push(term);
    chars += term.length;
  }
  return terms;
}

/** Fact keys that name an employer, as the Extractor writes them in snake_case. */
const EMPLOYER_KEY = /(^|_)(employer|company|firm|organi[sz]ation)(_|$)/;

export function employersFromFacts(facts: readonly { key: string; value: string }[]): string[] {
  return facts.filter((fact) => EMPLOYER_KEY.test(fact.key)).map((fact) => fact.value);
}
