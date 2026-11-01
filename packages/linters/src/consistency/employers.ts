// Employer names for the consistency check (spec §5.10): the Fact Sheet's employers and the
// résumé's organisations, and every place a document names one of them. A variant shares a
// distinctive word with a known name but is not the same name ("Meridian Health" or "Meridian
// Healthcare" for "Meridian Health Systems"). Case, punctuation, possessives and a trailing legal
// form ("GmbH", "Private Limited") never make a variant; an unrelated company is never one.

import type { FactRef } from "../types";
import { fold } from "./text";

export const EMPLOYER_KEY = /employer|company|organisation|organization|firm/iu;

/** Legal forms that may be dropped without changing which company is meant. */
const LEGAL = new Set([
  "gmbh",
  "ag",
  "ltd",
  "limited",
  "private",
  "pvt",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "plc",
  "sa",
  "corp",
]);

/** Words too common in organisation names to identify one. */
const GENERIC = new Set([
  ...LEGAL,
  "and",
  "of",
  "the",
  "an",
  "a",
  "de",
  "da",
  "do",
  "co",
  "company",
  "corporation",
  "group",
  "holdings",
  "system",
  "systems",
  "health",
  "healthcare",
  "hospital",
  "hospitals",
  "general",
  "partners",
  "partner",
  "trust",
  "foundation",
  "mills",
  "mill",
  "bank",
  "capital",
  "services",
  "service",
  "solutions",
  "technologies",
  "technology",
  "tech",
  "international",
  "global",
  "national",
  "municipal",
  "school",
  "escola",
  "professora",
  "university",
  "college",
  "institute",
  "instituto",
  "army",
  "navy",
  "force",
  "independent",
  "consultant",
  "consulting",
  "consultancy",
  "provision",
  "provisions",
  "great",
  "new",
  "first",
  "united",
  "central",
  "north",
  "south",
  "east",
  "west",
  "city",
  "nigerian",
  "indian",
  "american",
  "german",
  "kenyan",
  "brazilian",
  "mexican",
  "vietnamese",
  "british",
]);

const HONORIFIC = /\b(?:mr|mrs|ms|dr|sir|madam|señor|senor|sra|sr|dona|dom|prof)\.?\s*$/iu;

export interface Employer {
  id: string;
  /** As the Fact Sheet or résumé writes it. */
  name: string;
  /** Folded words, legal form removed. */
  words: string[];
  distinctive: Set<string>;
  /** The first distinctive word: a lone mention of it ("Meridian") is a short form. */
  first: string;
  fact: FactRef | null;
  /** The résumé role that introduced it, when no fact did. */
  roleRef: string | null;
}

/** Folded words of a name, "&" as "and", possessives and a trailing legal form removed. */
export function nameWords(name: string): string[] {
  const words = fold(name)
    .replace(/['’]s\b/gu, "")
    .replace(/&/gu, " and ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  while (words.length > 1 && LEGAL.has(words[words.length - 1] ?? "")) words.pop();
  return words;
}

/** The name part of a fact value: "Meridian Health Systems, Bengaluru" → "Meridian Health Systems". */
function nameOf(value: string): string {
  return (value.split(/\s+\(|;|,\s/u)[0] ?? value).trim();
}

function makeEmployer(
  id: string,
  rawName: string,
  fact: FactRef | null,
  roleRef: string | null,
): Employer | null {
  const name = nameOf(rawName);
  const words = nameWords(name);
  const distinctive = words.filter((w) => w.length >= 3 && !GENERIC.has(w));
  const first = distinctive[0];
  if (first === undefined) return null;
  return { id, name, words, distinctive: new Set(distinctive), first, fact, roleRef };
}

export interface EmployerMention {
  employer: Employer;
  /** The name as written, without a possessive or sentence punctuation. */
  said: string;
  index: number;
  end: number;
  /** Where the capitalised run holding it starts ("EM Professora Dalva Ribeiro" starts at "EM"). */
  runIndex: number;
  /** True when it is the known name (up to case, punctuation and legal form). */
  same: boolean;
}

const CAP = "[\\p{Lu}][\\p{L}\\p{M}\\p{N}'’.-]*";
const RUN = new RegExp(
  `${CAP}(?:\\s*&\\s*${CAP}|\\s+(?:(?:of|de|da|do|dos|das|del|von|van|der)\\s+)?${CAP})*`,
  "gu",
);
const RUN_TOKEN = /[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’.-]*|&/gu;

interface RunToken {
  word: string;
  index: number;
  end: number;
}

function runTokens(run: string, offset: number): RunToken[] {
  return [...run.matchAll(RUN_TOKEN)].map((m) => ({
    word: m[0] === "&" ? "and" : (nameWords(m[0])[0] ?? ""),
    index: offset + m.index,
    end: offset + m.index + m[0].length,
  }));
}

/** The said text of a span: no possessive, no sentence full stop ("Co." keeps its own). */
function trimSaid(text: string): string {
  let t = text.replace(/[,;:]+$/u, "").replace(/['’]s?$/u, "");
  if (/\.$/u.test(t) && !/\b[\p{L}]{1,3}\.$/u.test(t)) t = t.slice(0, -1);
  return t;
}

/**
 * Every mention of a known employer in the text, the same name or a variant. `whole` treats the
 * text as one name (a résumé organisation field), so any difference at all is a variant.
 */
export function findEmployers(
  text: string,
  employers: readonly Employer[],
  whole = false,
): EmployerMention[] {
  const found: EmployerMention[] = [];
  const runs = whole
    ? [{ run: text.trim(), index: text.indexOf(text.trim()) }]
    : [...text.matchAll(RUN)].map((m) => ({ run: m[0], index: m.index }));
  for (const { run, index } of runs) {
    let toks = runTokens(run, index).filter((t) => t.word !== "");
    // A full stop or a possessive ends a name ("Halverstead & Co. In 2024", "Meridian Health
    // Systems' Chennai team"), and so does "I" ("Before Meridian Health Systems I interned").
    const stop = toks.findIndex((t) => /(?:\.|['’]s?)$/u.test(text.slice(t.index, t.end)));
    if (!whole && stop !== -1) toks = toks.slice(0, stop + 1);
    const pronoun = toks.findIndex((t) => text.slice(t.index, t.end) === "I");
    if (!whole && pronoun !== -1) toks = toks.slice(0, pronoun);
    const words = toks.map((t) => t.word);
    // The known name, with nothing after it but a legal form.
    const exactAt = (e: Employer) => {
      const at = indexOfSeq(words, e.words);
      if (at === -1) return -1;
      return words.slice(at + e.words.length).every((w) => LEGAL.has(w)) ? at : -1;
    };
    // A run that is exactly some known employer belongs to it, never a variant of another.
    const exact = employers.find((e) => exactAt(e) !== -1);
    for (const e of employers) {
      if (exact && exact !== e) continue;
      if (!words.some((w) => e.distinctive.has(w))) continue;
      const at = exactAt(e);
      if (at !== -1) {
        const startTok = toks[at];
        const endTok = toks[at + e.words.length - 1];
        if (startTok && endTok)
          found.push({
            employer: e,
            said: trimSaid(text.slice(startTok.index, endTok.end)),
            index: startTok.index,
            end: endTok.end,
            runIndex: toks[0]?.index ?? startTok.index,
            same: true,
          });
        continue;
      }
      if (whole) {
        found.push({
          employer: e,
          said: trimSaid(text.trim()),
          index,
          end: index + run.length,
          runIndex: index,
          same: false,
        });
        continue;
      }
      const known = new Set(e.words);
      const i = words.findIndex((w) => known.has(w));
      const startTok = toks[i];
      if (i === -1 || !startTok) continue;
      const span = words.slice(i);
      const j = e.words.indexOf(span[0] ?? "");
      let common = 0;
      while (common < span.length && span[common] === e.words[j + common]) common += 1;
      // A shortened name ("Meridian Health") ends where the run does; a changed one ("Meridian
      // Healthcare", "Kalyan Auto Parts") keeps about as many words as the known name has.
      let length =
        common === span.length
          ? common
          : Math.min(span.length, Math.max(common + 1, e.words.length - j + 1));
      while (length < span.length && LEGAL.has(span[length] ?? "")) length += 1;
      const variant = span.slice(0, length);
      if (variant.length === 1 && variant[0] !== e.first) continue;
      if (variant.length > 1 && !variant.some((w) => e.distinctive.has(w))) continue;
      if (HONORIFIC.test(text.slice(Math.max(0, startTok.index - 8), startTok.index))) continue;
      const endTok = toks[i + length - 1] ?? startTok;
      found.push({
        employer: e,
        said: trimSaid(text.slice(startTok.index, endTok.end)),
        index: startTok.index,
        end: endTok.end,
        runIndex: toks[0]?.index ?? startTok.index,
        same: false,
      });
    }
  }
  return found;
}

function indexOfSeq(haystack: readonly string[], needle: readonly string[]): number {
  if (needle.length === 0) return -1;
  for (let i = 0; i + needle.length <= haystack.length; i += 1)
    if (needle.every((w, k) => haystack[i + k] === w)) return i;
  return -1;
}

/** Employers from the Fact Sheet, then résumé organisations that are not variants of them. */
export function knownEmployers(
  facts: readonly FactRef[],
  roles: readonly { ref: string; organisation: string }[],
): Employer[] {
  const out: Employer[] = [];
  for (const f of facts) {
    if (!EMPLOYER_KEY.test(f.key)) continue;
    const e = makeEmployer(`fact:${f.code}`, f.approvedPhrasing ?? f.value, f, null);
    if (e && !out.some((o) => o.words.join(" ") === e.words.join(" "))) out.push(e);
  }
  for (const r of roles) {
    if (findEmployers(r.organisation, out, true).length > 0) continue;
    const e = makeEmployer(`role:${r.ref}`, r.organisation, null, r.ref);
    if (e && !out.some((o) => o.words.join(" ") === e.words.join(" "))) out.push(e);
  }
  return out;
}
