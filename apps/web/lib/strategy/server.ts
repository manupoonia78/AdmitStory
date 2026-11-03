import "server-only";

import {
  getBrand,
  getCycleWithSchool,
  getDb,
  getGoals,
  getProfile,
  getPublishedPack,
  getVerifiedAiPolicy,
  listFacts,
  listSchoolVotes,
  listUserSchools,
  type DbExecutor,
  type PublishedPack,
  type SchoolSummary,
  type UserSchoolWithSchool,
} from "@admitstory/db";
import type { SchoolPack } from "@admitstory/kb/types";
import { strategyApplicant, type StrategyApplicant } from "./applicant";
import {
  aiPolicyLine,
  asPack,
  citationFor,
  essaySummary,
  interviewLine,
  limitText,
  packRounds,
  writtenPrompts,
} from "./pack";
import { readStoredFit, type StoredFit } from "./stored-fit";
import type { SchoolCard, SourcedLine } from "./types";

// School Strategy's reads (spec §5.5). Pages and routes read the newest published pack at request
// time, so a version an admin just published shows on the next request (Phase 3 AC: "within a
// minute"). Pack versions never change once published, so a version is cached by its number.

const packCache = new Map<string, PublishedPack | null>();
const PACK_CACHE_MAX = 200;

/** A published pack by cycle and version, cached: a published version is immutable. */
async function packVersion(
  db: DbExecutor,
  cycleId: string,
  version: number,
): Promise<PublishedPack | null> {
  const key = `${cycleId}@${version}`;
  if (packCache.has(key)) return packCache.get(key) ?? null;
  const pack = await getPublishedPack(db, cycleId, version);
  if (packCache.size >= PACK_CACHE_MAX) packCache.clear();
  packCache.set(key, pack);
  return pack;
}

/** The newest published pack for a cycle, read now (not cached: a new version must show at once). */
export async function latestPack(db: DbExecutor, cycleId: string): Promise<PublishedPack | null> {
  return getPublishedPack(db, cycleId);
}

export async function loadApplicant(userId: string): Promise<StrategyApplicant> {
  const db = getDb();
  const [profile, goals, brand, facts] = await Promise.all([
    getProfile(db, userId),
    getGoals(db, userId),
    getBrand(db, userId),
    listFacts(db, userId),
  ]);
  return strategyApplicant({ profile, goals, brand, facts });
}

/** "Add schools" results (§5.5): each school with its verified facts, or "Pack coming soon". */
export async function schoolCards(
  db: DbExecutor,
  summaries: readonly SchoolSummary[],
  userId: string,
  timeZone: string,
): Promise<SchoolCard[]> {
  const [votes, mine] = await Promise.all([
    listSchoolVotes(db, userId),
    listUserSchools(db, userId),
  ]);
  const voted = new Set(votes);
  return Promise.all(
    summaries.map(async (summary): Promise<SchoolCard> => {
      const published =
        summary.cycle && summary.publishedPack
          ? await packVersion(db, summary.cycle.id, summary.publishedPack.version)
          : null;
      const pack = published ? asPack(published.data) : null;
      const registry =
        published && summary.cycle ? await getVerifiedAiPolicy(db, summary.cycle.id) : null;
      const own = mine.find((row) => row.cycle.id === summary.cycle?.id);
      return cardFor(
        summary,
        published,
        pack,
        registry,
        timeZone,
        voted.has(summary.id),
        own?.id ?? null,
      );
    }),
  );
}

function cardFor(
  summary: SchoolSummary,
  published: PublishedPack | null,
  pack: SchoolPack | null,
  registry: Awaited<ReturnType<typeof getVerifiedAiPolicy>>,
  timeZone: string,
  voted: boolean,
  userSchoolId: string | null,
): SchoolCard {
  const base = {
    schoolId: summary.id,
    name: summary.name,
    shortName: summary.shortName,
    cycleId: summary.cycle?.id ?? null,
    cycle: summary.cycle?.cycle ?? null,
    voted,
    userSchoolId,
  };
  if (!published || !pack)
    return {
      ...base,
      pack: "coming_soon",
      packVersion: null,
      verifiedOn: null,
      rounds: [],
      essays: null,
      interview: null,
      aiPolicy: null,
    };
  return {
    ...base,
    pack: "published",
    packVersion: published.version,
    verifiedOn: published.publishedAt.toISOString().slice(0, 10),
    rounds: packRounds(pack, timeZone),
    essays: essaySummary(pack),
    interview: interviewLine(pack),
    aiPolicy: aiPolicyLine(pack, registry, summary.cycle?.cycle ?? null),
  };
}

/** One school on the applicant's list, with the pack the page should read right now. */
export interface StrategySchool {
  row: UserSchoolWithSchool;
  published: PublishedPack | null;
  pack: SchoolPack | null;
  fit: StoredFit;
  /** The stored fit was computed against an older pack version (or never). */
  fitStale: boolean;
}

export async function loadUserSchools(db: DbExecutor, userId: string): Promise<StrategySchool[]> {
  const rows = await listUserSchools(db, userId);
  return Promise.all(
    rows.map(async (row): Promise<StrategySchool> => {
      const published = await latestPack(db, row.cycle.id);
      const fit = readStoredFit(row.fit);
      return {
        row,
        published,
        pack: published ? asPack(published.data) : null,
        fit,
        fitStale: published !== null && row.fitPackVersion !== published.version,
      };
    }),
  );
}

/** One verified prompt, verbatim, with its limit and source (GET /api/schools/:id/cycles/:cycle). */
export interface SourcedPrompt extends SourcedLine {
  key: string;
  limit: string;
  required: boolean;
}

/**
 * One school-cycle by school id and cycle name ("2026-27"), with its verified prompts. Null when the
 * school or cycle doesn't exist. Public school data; the caller only adds their own vote and list.
 */
export async function schoolCycleDetail(
  db: DbExecutor,
  schoolId: string,
  cycleName: string,
  userId: string,
  timeZone: string,
): Promise<{ card: SchoolCard; prompts: SourcedPrompt[] } | null> {
  const found = await getDb().query.schoolCycles.findFirst({
    where: (t, { and, eq }) => and(eq(t.schoolId, schoolId), eq(t.cycle, cycleName)),
    columns: { id: true },
  });
  if (!found) return null;
  const row = await getCycleWithSchool(db, found.id);
  if (!row) return null;
  const published = await latestPack(db, found.id);
  const pack = published ? asPack(published.data) : null;
  const [registry, votes, mine] = await Promise.all([
    published ? getVerifiedAiPolicy(db, found.id) : Promise.resolve(null),
    listSchoolVotes(db, userId),
    listUserSchools(db, userId),
  ]);
  const summary: SchoolSummary = {
    id: row.school.id,
    slug: row.school.slug,
    name: row.school.name,
    shortName: row.school.shortName,
    country: row.school.country,
    city: row.school.city,
    website: row.school.website,
    region: row.school.region,
    cycle: { id: row.cycle.id, cycle: row.cycle.cycle, status: row.cycle.status },
    publishedPack: published
      ? { id: published.id, version: published.version, publishedAt: published.publishedAt }
      : null,
  };
  const card = cardFor(
    summary,
    published,
    pack,
    registry,
    timeZone,
    votes.includes(row.school.id),
    mine.find((m) => m.cycle.id === found.id)?.id ?? null,
  );
  const prompts: SourcedPrompt[] = pack
    ? writtenPrompts(pack).flatMap((p) => {
        const citation = citationFor(pack, p, { label: "Essay prompts" });
        return citation && p.prompt_verbatim
          ? [
              {
                key: p.key,
                text: p.prompt_verbatim,
                limit: limitText(p.limit, p.list_count),
                required: p.required,
                citation,
              },
            ]
          : [];
      })
    : [];
  return { card, prompts };
}
