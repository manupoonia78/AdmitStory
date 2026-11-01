// When the Profile Read is rebuilt (spec §5.4 AC): automatically after a significant dossier change,
// at most once a day, or whenever the applicant asks (rate-limited at the route). Pure, so the
// Inngest function, the page and the tests decide the same way.

export const AUTO_REBUILD_INTERVAL_MS = 24 * 60 * 60_000;

/** A dossier this thin gets the empty state, not a read: there is nothing to cite yet. */
export const MIN_STORIES_FOR_READ = 2;

/** What a read was built from: the codes in the snapshot it read. */
export interface ReadBasis {
  storyCodes: readonly string[];
  factCodes: readonly string[];
}

/**
 * Significant: a story arrived or went, or at least three facts changed. A corrected spelling or a
 * single new number isn't worth a new read; a new story always is, because every lens is made of
 * stories.
 */
export const SIGNIFICANT_FACT_CHANGES = 3;

export function significantChange(previous: ReadBasis | null, next: ReadBasis): boolean {
  if (!previous) return true;
  const before = new Set(previous.storyCodes);
  const after = new Set(next.storyCodes);
  if (before.size !== after.size || [...after].some((code) => !before.has(code))) return true;
  const factsBefore = new Set(previous.factCodes);
  const factsAfter = new Set(next.factCodes);
  const changed =
    [...factsAfter].filter((code) => !factsBefore.has(code)).length +
    [...factsBefore].filter((code) => !factsAfter.has(code)).length;
  return changed >= SIGNIFICANT_FACT_CHANGES;
}

export type BuildReason = "manual" | "dossier_changed" | "schools_changed" | "first_visit";

export interface BuildFacts {
  reason: BuildReason;
  latest: { createdAt: Date; snapshotVersion: number | null; basis: ReadBasis | null } | null;
  snapshot: { version: number; basis: ReadBasis };
  storyCount: number;
  now: Date;
}

export type BuildDecision =
  { build: true } | { build: false; why: "thin" | "unchanged" | "minor_change" | "too_soon" };

export function shouldBuild(facts: BuildFacts): BuildDecision {
  if (facts.storyCount < MIN_STORIES_FOR_READ) return { build: false, why: "thin" };
  const { latest } = facts;
  if (!latest) return { build: true };
  if (facts.reason === "manual") return { build: true };
  if (latest.snapshotVersion === facts.snapshot.version) return { build: false, why: "unchanged" };
  if (!significantChange(latest.basis, facts.snapshot.basis))
    return { build: false, why: "minor_change" };
  if (facts.now.getTime() - latest.createdAt.getTime() < AUTO_REBUILD_INTERVAL_MS)
    return { build: false, why: "too_soon" };
  return { build: true };
}
