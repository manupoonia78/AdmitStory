// Reading a published School Pack for the applicant (spec §5.5, §9.2). Pure, so the comparison,
// flags and planner can be tested without a database.
//
// The one rule here: a school fact reaches the page only with a Citation that has a source, a year
// and the date it was verified (§0, Phase 3 AC). Anything whose `verified_at` is null is dropped,
// even inside a published pack, rather than shown without its date.

import { citedNodes } from "@admitstory/kb";
import type {
  AiStance,
  EssayPrompt,
  Interview,
  PackCited,
  PromptLimit,
  SchoolPack,
} from "@admitstory/kb/types";
import type { Citation } from "@admitstory/ui";
import type { CardRound, SourcedLine } from "./types";

/**
 * A published pack's data. It was checked by packages/kb's schema when it was published, and the
 * database stores whatever that schema accepted (packages/db `SchoolPackData`), so this only gives
 * it its type back. Callers never pass a draft.
 */
export function asPack(data: Record<string, unknown>): SchoolPack {
  return data as unknown as SchoolPack;
}

/** A retrieved chunk a stored fit cited (K900001…), kept so its citation can be shown later. */
export interface RetrievalSource {
  id: string;
  source: string;
  url: string | null;
  verifiedAt: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function sourceOf(pack: SchoolPack, sourceIds: readonly string[]) {
  return sourceIds.map((id) => pack.sources.find((s) => s.id === id)).find(Boolean) ?? null;
}

/**
 * The citation for one cited record of the pack, or null when it has no verified date or no source
 * the pack knows. `label` names the document ("Class profile"); without one, the source's title is
 * used. `year` is the year the figure describes; without one, the cycle.
 */
export function citationFor(
  pack: SchoolPack,
  node: Pick<PackCited, "source_ids" | "verified_at"> | null | undefined,
  options: { label?: string; year?: string | number } = {},
): Citation | null {
  if (!node || !node.verified_at || !ISO_DATE.test(node.verified_at)) return null;
  const source = sourceOf(pack, node.source_ids);
  if (!source) return null;
  return {
    source: options.label ?? source.title,
    year: options.year ?? pack.cycle,
    verifiedOn: node.verified_at.slice(0, 10),
    ...(source.url ? { url: source.url } : {}),
  };
}

/**
 * Resolves a K code a model cited: a pack item ("K42") or a retrieved chunk ("K900003"). Returns
 * null for anything else, so a claim whose source can't be shown is left out rather than shown bare.
 */
export function citeCode(
  pack: SchoolPack,
  code: string,
  retrieval: readonly RetrievalSource[] = [],
): Citation | null {
  const chunk = retrieval.find((r) => r.id === code);
  if (chunk) {
    if (!chunk.verifiedAt || !ISO_DATE.test(chunk.verifiedAt)) return null;
    return {
      source: chunk.source,
      year: chunk.verifiedAt.slice(0, 4),
      verifiedOn: chunk.verifiedAt.slice(0, 10),
      ...(chunk.url ? { url: chunk.url } : {}),
    };
  }
  const node = citedNodes(pack).find((n) => n.id === code);
  if (!node) return null;
  return citationFor(pack, { source_ids: node.sourceIds, verified_at: node.verifiedAt });
}

/** The first of several cites that resolves. */
export function firstCitation(
  pack: SchoolPack,
  codes: readonly string[],
  retrieval: readonly RetrievalSource[] = [],
): Citation | null {
  for (const code of codes) {
    const citation = citeCode(pack, code, retrieval);
    if (citation) return citation;
  }
  return null;
}

/* Dates ----------------------------------------------------------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Sep 2026" from "2026-09-12": the house date style (three-letter months, §5.5). */
export function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Minutes east of UTC for a time zone at an instant. */
function offsetMinutes(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(at));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return Math.round((local - at) / 60_000);
}

/**
 * A pack deadline as an instant: the end of that calendar day (23:59) in the applicant's time zone.
 * Packs state deadlines as dates without a time (§9.2 `Round.deadline`), so this is the reading that
 * never makes a deadline look later than the school's own date (spec §5.5: deadlines in the user's
 * time zone).
 */
export function deadlineInstant(date: string, timeZone: string): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, 23, 59);
  let instant = guess - offsetMinutes(guess, timeZone) * 60_000;
  // Once more, in case the first guess fell on the other side of a daylight-saving change.
  instant = guess - offsetMinutes(instant, timeZone) * 60_000;
  return new Date(instant).toISOString();
}

/** "Round 2" from "R2"; anything else is shown as the pack names it. */
export function roundLabel(name: string): string {
  const match = /^R(\d)$/i.exec(name.trim());
  return match ? `Round ${match[1]}` : name;
}

/** The pack's verified rounds, in date order, with their deadlines in the applicant's time zone. */
export function packRounds(pack: SchoolPack, timeZone: string): CardRound[] {
  return pack.rounds
    .map((round): CardRound | null => {
      const citation = citationFor(pack, round, { label: "Deadlines", year: pack.cycle });
      if (!citation || !ISO_DATE.test(round.deadline)) return null;
      return {
        id: round.id,
        label: roundLabel(round.name),
        short: round.name.length <= 4 ? round.name : roundLabel(round.name),
        deadline: deadlineInstant(round.deadline, timeZone),
        date: round.deadline.slice(0, 10),
        citation,
      };
    })
    .filter((round): round is CardRound => round !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* Essays, interview, AI policy ----------------------------------------------------------------- */

const numberFormat = new Intl.NumberFormat("en-GB");

/** "500 words", "1,000 characters", "6 × 50 words". */
export function limitText(limit: PromptLimit, listCount?: number): string {
  const n = numberFormat.format(limit.value);
  const unit =
    limit.kind === "words"
      ? "words"
      : limit.kind === "chars_incl_spaces"
        ? "characters"
        : "characters, not counting spaces";
  return listCount && listCount > 1 ? `${listCount} × ${n} ${unit}` : `${n} ${unit}`;
}

/** The written prompts an applicant drafts: essays, short answers and goal fields. */
export function writtenPrompts(pack: SchoolPack): EssayPrompt[] {
  const { essays, short_answers, goal_fields } = pack.application;
  return [...essays, ...short_answers, ...goal_fields].filter(
    (prompt) => prompt.verified_at !== null && citationFor(pack, prompt) !== null,
  );
}

export function essaySummary(pack: SchoolPack): {
  count: number;
  lengths: string[];
  citation: Citation;
} | null {
  const prompts = writtenPrompts(pack).filter((p) => p.required);
  const first = prompts[0];
  const citation = first ? citationFor(pack, first, { label: "Essay prompts" }) : null;
  if (!citation) return null;
  return {
    count: prompts.length,
    lengths: prompts.map((p) => limitText(p.limit, p.list_count)),
    citation,
  };
}

const INVITATION: Record<Interview["invitation"], string> = {
  invite_only: "By invitation",
  open: "Open to every applicant",
  guaranteed_if_by_date: "Guaranteed if you apply by a set date",
};
const WHO: Record<Interview["who"][number], string> = {
  adcom: "admissions staff",
  student: "students",
  alum: "alumni",
};
const WHERE: Record<Interview["location"][number], string> = {
  campus: "on campus",
  virtual: "online",
  hub: "in a city hub",
};

function joinOr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

/** "By invitation, with admissions staff, 30 min, on campus or online." */
export function interviewLine(pack: SchoolPack): SourcedLine | null {
  const interview = pack.interview;
  const citation = citationFor(pack, interview, { label: "Interview format" });
  if (!interview || !citation) return null;
  const parts = [
    INVITATION[interview.invitation],
    interview.who.length > 0 ? `with ${joinOr(interview.who.map((w) => WHO[w]))}` : null,
    `${interview.length_min} min`,
    interview.location.length > 0 ? joinOr(interview.location.map((l) => WHERE[l])) : null,
  ].filter(Boolean);
  return { text: parts.join(", "), citation };
}

export const AI_STANCE_WORDS: Record<AiStance, string> = {
  permitted: "AI tools permitted",
  permitted_with_disclosure: "AI tools permitted with disclosure",
  limited: "Limited AI use",
  prohibited: "AI tools not permitted",
  unknown: "No published AI policy",
};

/** A verified policy from the registry (§14.2), as packages/db stores it. */
export interface VerifiedPolicyRow {
  stance: AiStance;
  sourceUrl: string | null;
  verifiedAt: Date | null;
}

/**
 * The AI policy stance, verified only (§5.5, §14.2). The registry's verified row wins; otherwise the
 * pack's own verified record. Null when neither is verified.
 */
export function aiPolicyLine(
  pack: SchoolPack | null,
  registry: VerifiedPolicyRow | null,
  cycle: string | null,
): SourcedLine | null {
  if (registry?.verifiedAt) {
    const verifiedOn = registry.verifiedAt.toISOString().slice(0, 10);
    return {
      text: AI_STANCE_WORDS[registry.stance],
      citation: {
        source: "AI policy",
        year: cycle ?? verifiedOn.slice(0, 4),
        verifiedOn,
        ...(registry.sourceUrl ? { url: registry.sourceUrl } : {}),
      },
    };
  }
  if (!pack) return null;
  const citation = citationFor(pack, pack.ai_policy, { label: "AI policy" });
  return citation ? { text: AI_STANCE_WORDS[pack.ai_policy.stance], citation } : null;
}
