// Freshness (spec §9.3): "items older than the current cycle are greyed in admin and excluded from
// user-facing 'why school' specifics until re-verified". A K item is stale when it was verified
// before the current cycle opened. Staleness depends only on the cycle, never on today's date, so
// the compiled pack stays byte-for-byte stable for a whole cycle (§8.2).
//
// When a cycle "opens": schools publish essay prompts between May and July for applications that
// start in the autumn, so cycle "2026-27" opens on 1 May 2026. That date is an assumption, not a
// school fact; pass `opensOn` to override it.

import { citedNodes } from "./walk";
import type { IsoDate, KbSourceType, SchoolPack } from "./types";

export const CYCLE_OPENS_ON = "05-01";

/** "2026-27" → "2026-05-01". Throws on a malformed cycle. */
export function cycleStart(cycle: string, opensOn: string = CYCLE_OPENS_ON): IsoDate {
  const match = /^(\d{4})-(\d{2})$/.exec(cycle);
  const [, first, second] = match ?? [];
  if (first === undefined || second === undefined || (Number(first) + 1) % 100 !== Number(second))
    throw new Error(`Not a cycle like "2026-27": ${cycle}`);
  return `${first}-${opensOn}`;
}

/** Stale: verified before `cycle` opened. Unverified (null) is not stale; it is worse — see compiler. */
export function isStale(verifiedAt: IsoDate | null, cycle: string, opensOn?: string): boolean {
  return verifiedAt !== null && verifiedAt < cycleStart(cycle, opensOn);
}

/**
 * Whether a compiled-pack entry may be cited as a school specific in anything a user reads
 * (a why-school sentence, School Strategy, the `unverifiedSchool` linter's check, §8.7). Takes the
 * compiled `itemIndex` entry, which only exists for verified items. An admin-approved rewrite of
 * third-party notes (`sourceType: null`) has no source a user can be shown (§0, §9.6), so it is
 * background for the model, never a cited specific.
 */
export function isCitableSpecific(
  entry: { stale: boolean; sourceType: KbSourceType | null } | undefined,
): boolean {
  return entry !== undefined && !entry.stale && entry.sourceType !== null;
}

export interface SectionFreshness {
  section: string;
  /** Oldest verified date in the section: what "verified on" shows, conservatively. */
  verifiedOn: IsoDate | null;
  newest: IsoDate | null;
  total: number;
  stale: number;
  unverified: number;
}

/** Per top-level section, for the pack's "verified on" labels and the admin's greying (§9.3). */
export function sectionFreshness(
  pack: SchoolPack,
  cycle: string,
  opensOn?: string,
): SectionFreshness[] {
  const bySection = new Map<string, SectionFreshness>();
  for (const node of citedNodes(pack)) {
    const entry = bySection.get(node.section) ?? {
      section: node.section,
      verifiedOn: null,
      newest: null,
      total: 0,
      stale: 0,
      unverified: 0,
    };
    entry.total += 1;
    if (node.verifiedAt === null) entry.unverified += 1;
    else {
      if (isStale(node.verifiedAt, cycle, opensOn)) entry.stale += 1;
      if (entry.verifiedOn === null || node.verifiedAt < entry.verifiedOn)
        entry.verifiedOn = node.verifiedAt;
      if (entry.newest === null || node.verifiedAt > entry.newest) entry.newest = node.verifiedAt;
    }
    bySection.set(node.section, entry);
  }
  return [...bySection.values()];
}
