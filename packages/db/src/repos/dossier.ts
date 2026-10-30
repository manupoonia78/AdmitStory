// The Applicant Dossier (spec §5.3, §10): Fact Sheet, Story Bank, golden lines, people, brand,
// voice profile, goals and the compact snapshots compiled from them.
//
// Provenance codes (F01, S03, L041, P2) are allocated here, inside the same transaction as the
// insert, so two concurrent extractions cannot hand out the same code. Ownership is checked on
// every statement.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  applicantHandle,
  compileDossier,
  nextCode,
  type CompiledDossier,
  type DossierInput,
  type LensId,
  type TraitId,
} from "@admitstory/shared";
import { z } from "zod";
import type { Database, DbExecutor } from "../client";
import {
  brand,
  chapters,
  dossierSnapshots,
  factStatuses,
  facts,
  goals,
  goldenLines,
  people,
  profiles,
  sensitivities,
  stories,
  storyContexts,
  storyStatuses,
  type BrandTrait,
  type FactEvidence,
  type StoryMissing,
  type StoryNumber,
  type VoiceStats,
} from "../schema";
import { voiceProfiles } from "../schema";
import { assertId } from "./ids";

export type Fact = typeof facts.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type GoldenLine = typeof goldenLines.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Brand = typeof brand.$inferSelect;
export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type Goals = typeof goals.$inferSelect;
export type DossierSnapshot = typeof dossierSnapshots.$inferSelect;

const shortText = (max: number) => z.string().trim().min(1).max(max);

/* Facts -------------------------------------------------------------------------------------- */

export const NewFact = z.strictObject({
  key: shortText(80),
  value: shortText(2000),
  note: z.string().trim().max(500).nullable().optional(),
  status: z.enum(factStatuses).optional(),
  sensitivity: z.enum(sensitivities).optional(),
  evidence: z
    .array(
      z.strictObject({
        sourceId: z.guid(),
        spans: z.array(z.strictObject({ start: z.int().min(0), end: z.int().min(0) })).max(20),
      }),
    )
    .max(20)
    .optional(),
});

export type NewFact = z.input<typeof NewFact>;

export async function listFacts(db: DbExecutor, userId: string): Promise<Fact[]> {
  return db
    .select()
    .from(facts)
    .where(eq(facts.userId, assertId(userId, "userId")))
    .orderBy(asc(facts.code));
}

export async function getFact(
  db: DbExecutor,
  userId: string,
  factId: string,
): Promise<Fact | null> {
  const [row] = await db
    .select()
    .from(facts)
    .where(
      and(eq(facts.userId, assertId(userId, "userId")), eq(facts.id, assertId(factId, "factId"))),
    )
    .limit(1);
  return row ?? null;
}

export const FactPatch = z
  .strictObject({
    key: shortText(80),
    value: shortText(2000),
    note: z.string().trim().max(500).nullable(),
    approvedPhrasing: z.string().trim().max(2000).nullable(),
    status: z.enum(factStatuses),
    sensitivity: z.enum(sensitivities),
    consentToUse: z.boolean(),
  })
  .partial();

export type FactPatch = z.input<typeof FactPatch>;

export async function updateFact(
  db: DbExecutor,
  userId: string,
  factId: string,
  patch: FactPatch,
): Promise<Fact | null> {
  const values = FactPatch.parse(patch);
  if (Object.keys(values).length === 0) return getFact(db, userId, factId);
  const [row] = await db
    .update(facts)
    .set(values)
    .where(
      and(eq(facts.userId, assertId(userId, "userId")), eq(facts.id, assertId(factId, "factId"))),
    )
    .returning();
  return row ?? null;
}

/**
 * Resolves a conflict by choosing which value is current (spec §5.3a: "You said a team of 11
 * earlier and 13 today. Which is current?"). The losing value is kept in `conflict.note` so the
 * history is not lost, and the fact becomes confirmed.
 */
export async function resolveFactConflict(
  db: DbExecutor,
  userId: string,
  factId: string,
  choice: "current" | "other",
): Promise<Fact | null> {
  const ownerId = assertId(userId, "userId");
  const fact = await getFact(db, ownerId, factId);
  if (!fact) return null;
  const other = fact.conflict?.otherValue;
  const keep = choice === "other" && other !== undefined ? other : fact.value;
  const dropped = choice === "other" ? fact.value : other;
  const [row] = await db
    .update(facts)
    .set({
      value: keep,
      status: "confirmed",
      conflict: dropped === undefined ? null : { otherValue: dropped, note: "superseded" },
    })
    .where(and(eq(facts.userId, ownerId), eq(facts.id, fact.id)))
    .returning();
  return row ?? null;
}

/**
 * Records extracted facts. A fact whose key already exists is matched by key: the same value
 * confirms it, a different one raises a conflict for the applicant to resolve (§5.3a). Never
 * silently overwrites, because the Fact Sheet is the single source of truth.
 */
export async function upsertFacts(
  db: Database,
  userId: string,
  incoming: readonly NewFact[],
): Promise<{ created: Fact[]; conflicted: Fact[]; confirmed: Fact[] }> {
  const ownerId = assertId(userId, "userId");
  const values = incoming.map((entry) => NewFact.parse(entry));
  if (values.length === 0) return { created: [], conflicted: [], confirmed: [] };

  return db.transaction(async (tx) => {
    const existing = await tx.select().from(facts).where(eq(facts.userId, ownerId));
    const byKey = new Map(existing.map((row) => [row.key, row] as const));
    const used = new Set(existing.map((row) => row.code));

    const created: Fact[] = [];
    const conflicted: Fact[] = [];
    const confirmed: Fact[] = [];

    for (const entry of values) {
      const match = byKey.get(entry.key);
      if (!match) {
        const code = nextCode("fact", used);
        used.add(code);
        const [row] = await tx
          .insert(facts)
          .values({
            userId: ownerId,
            code,
            key: entry.key,
            value: entry.value,
            note: entry.note ?? null,
            status: entry.status ?? "needs_confirmation",
            sensitivity: entry.sensitivity ?? "none",
            // Spec §14.3: sensitive material is private until the applicant opts in.
            consentToUse: (entry.sensitivity ?? "none") !== "sensitive",
            evidence: (entry.evidence as FactEvidence[] | undefined) ?? null,
          })
          .returning();
        if (row) {
          created.push(row);
          byKey.set(row.key, row);
        }
        continue;
      }

      if (match.value === entry.value) {
        if (match.status !== "confirmed") {
          const [row] = await tx
            .update(facts)
            .set({ status: "confirmed" })
            .where(and(eq(facts.userId, ownerId), eq(facts.id, match.id)))
            .returning();
          if (row) {
            confirmed.push(row);
            byKey.set(row.key, row);
          }
        }
        continue;
      }

      const [row] = await tx
        .update(facts)
        .set({ status: "conflict", conflict: { otherValue: entry.value } })
        .where(and(eq(facts.userId, ownerId), eq(facts.id, match.id)))
        .returning();
      if (row) {
        conflicted.push(row);
        byKey.set(row.key, row);
      }
    }

    return { created, conflicted, confirmed };
  });
}

/* Stories ------------------------------------------------------------------------------------ */

export const NewStory = z.strictObject({
  nickname: shortText(80),
  era: z.string().trim().max(60).nullable().optional(),
  context: z.enum(storyContexts).optional(),
  chapter: z.enum(chapters).nullable().optional(),
  situation: z.string().trim().max(4000).nullable().optional(),
  stakes: z.string().trim().max(4000).nullable().optional(),
  actions: z.array(z.string().trim().max(1000)).max(20).optional(),
  result: z.string().trim().max(4000).nullable().optional(),
  reflection: z.string().trim().max(4000).nullable().optional(),
  numbers: z
    .array(
      z.strictObject({
        label: shortText(80),
        value: shortText(120),
        factCode: z.string().max(16).optional(),
      }),
    )
    .max(20)
    .optional(),
  traits: z.array(z.string().max(60)).max(12).optional(),
  lenses: z.array(z.string().max(30)).max(8).optional(),
  archetypes: z.array(z.string().max(30)).max(12).optional(),
  slotKeys: z.array(z.string().max(80)).max(20).optional(),
  peopleCodes: z.array(z.string().max(16)).max(20).optional(),
  status: z.enum(storyStatuses).optional(),
  missing: z
    .array(
      z.strictObject({ question: shortText(400), approxWords: z.int().min(1).max(500).optional() }),
    )
    .max(10)
    .optional(),
  sensitivity: z.enum(sensitivities).optional(),
  evidence: z
    .array(
      z.strictObject({
        sourceId: z.guid(),
        spans: z.array(z.strictObject({ start: z.int().min(0), end: z.int().min(0) })).max(20),
      }),
    )
    .max(20)
    .optional(),
  confidence: z.string().max(8).nullable().optional(),
});

export type NewStory = z.input<typeof NewStory>;

export interface StoryFilter {
  lens?: string;
  trait?: string;
  status?: (typeof storyStatuses)[number];
  context?: (typeof storyContexts)[number];
  includeMerged?: boolean;
}

export async function listStories(
  db: DbExecutor,
  userId: string,
  filter: StoryFilter = {},
): Promise<Story[]> {
  const ownerId = assertId(userId, "userId");
  const conditions = [eq(stories.userId, ownerId)];
  if (!filter.includeMerged) conditions.push(sql`${stories.mergedInto} is null`);
  if (filter.status) conditions.push(eq(stories.status, filter.status));
  if (filter.context) conditions.push(eq(stories.context, filter.context));
  if (filter.lens) conditions.push(sql`${filter.lens} = any(${stories.lenses})`);
  if (filter.trait) conditions.push(sql`${filter.trait} = any(${stories.traits})`);
  return db
    .select()
    .from(stories)
    .where(and(...conditions))
    .orderBy(asc(stories.code));
}

export async function getStory(
  db: DbExecutor,
  userId: string,
  storyId: string,
): Promise<Story | null> {
  const [row] = await db
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.userId, assertId(userId, "userId")),
        eq(stories.id, assertId(storyId, "storyId")),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const StoryPatch = z
  .strictObject({
    nickname: shortText(80),
    era: z.string().trim().max(60).nullable(),
    context: z.enum(storyContexts),
    chapter: z.enum(chapters).nullable(),
    situation: z.string().trim().max(4000).nullable(),
    stakes: z.string().trim().max(4000).nullable(),
    actions: z.array(z.string().trim().max(1000)).max(20),
    result: z.string().trim().max(4000).nullable(),
    reflection: z.string().trim().max(4000).nullable(),
    numbers: z
      .array(
        z.strictObject({
          label: shortText(80),
          value: shortText(120),
          factCode: z.string().max(16).optional(),
        }),
      )
      .max(20)
      .nullable(),
    traits: z.array(z.string().max(60)).max(12),
    lenses: z.array(z.string().max(30)).max(8),
    status: z.enum(storyStatuses),
    missing: z
      .array(
        z.strictObject({
          question: shortText(400),
          approxWords: z.int().min(1).max(500).optional(),
        }),
      )
      .max(10)
      .nullable(),
    sensitivity: z.enum(sensitivities),
    consentToUse: z.boolean(),
  })
  .partial();

export type StoryPatch = z.input<typeof StoryPatch>;

export async function updateStory(
  db: DbExecutor,
  userId: string,
  storyId: string,
  patch: StoryPatch,
): Promise<Story | null> {
  const values = StoryPatch.parse(patch);
  if (Object.keys(values).length === 0) return getStory(db, userId, storyId);
  const [row] = await db
    .update(stories)
    .set(values as Record<string, unknown>)
    .where(
      and(
        eq(stories.userId, assertId(userId, "userId")),
        eq(stories.id, assertId(storyId, "storyId")),
      ),
    )
    .returning();
  return row ?? null;
}

export async function createStories(
  db: Database,
  userId: string,
  incoming: readonly NewStory[],
): Promise<Story[]> {
  const ownerId = assertId(userId, "userId");
  const values = incoming.map((entry) => NewStory.parse(entry));
  if (values.length === 0) return [];

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ code: stories.code })
      .from(stories)
      .where(eq(stories.userId, ownerId));
    const used = new Set(existing.map((row) => row.code));
    const created: Story[] = [];
    for (const entry of values) {
      const code = nextCode("story", used);
      used.add(code);
      const sensitivity = entry.sensitivity ?? "none";
      const [row] = await tx
        .insert(stories)
        .values({
          userId: ownerId,
          code,
          nickname: entry.nickname,
          era: entry.era ?? null,
          context: entry.context ?? "professional",
          chapter: entry.chapter ?? null,
          situation: entry.situation ?? null,
          stakes: entry.stakes ?? null,
          actions: entry.actions ?? [],
          result: entry.result ?? null,
          reflection: entry.reflection ?? null,
          numbers: (entry.numbers as StoryNumber[] | undefined) ?? null,
          traits: entry.traits ?? [],
          lenses: entry.lenses ?? [],
          archetypes: entry.archetypes ?? [],
          slotKeys: entry.slotKeys ?? [],
          peopleCodes: entry.peopleCodes ?? [],
          status: entry.status ?? "unconfirmed",
          missing: (entry.missing as StoryMissing[] | undefined) ?? null,
          sensitivity,
          // Spec §14.3: sensitive stories are private by default, story by story.
          consentToUse: sensitivity !== "sensitive",
          evidence: (entry.evidence as FactEvidence[] | undefined) ?? null,
          confidence: entry.confidence ?? null,
        })
        .returning();
      if (row) created.push(row);
    }
    return created;
  });
}

/**
 * Merges one story into another (spec §5.3b). The loser keeps its row and gains `merged_into`, so
 * every golden line and citation that already points at it still resolves; it simply stops being
 * listed and stops reaching the dossier snapshot.
 */
export async function mergeStories(
  db: Database,
  userId: string,
  keepId: string,
  mergeId: string,
): Promise<Story | null> {
  const ownerId = assertId(userId, "userId");
  const keep = assertId(keepId, "keepId");
  const merge = assertId(mergeId, "mergeId");
  if (keep === merge) throw new TypeError("A story cannot be merged into itself");

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(stories)
      .where(and(eq(stories.userId, ownerId), inArray(stories.id, [keep, merge])));
    const target = rows.find((row) => row.id === keep);
    const loser = rows.find((row) => row.id === merge);
    if (!target || !loser) return null;

    const union = <T>(a: readonly T[], b: readonly T[]) => [...new Set([...a, ...b])];
    const [updated] = await tx
      .update(stories)
      .set({
        actions: union(target.actions, loser.actions),
        traits: union(target.traits, loser.traits),
        lenses: union(target.lenses, loser.lenses),
        archetypes: union(target.archetypes, loser.archetypes),
        slotKeys: union(target.slotKeys, loser.slotKeys),
        peopleCodes: union(target.peopleCodes, loser.peopleCodes),
        numbers: [...(target.numbers ?? []), ...(loser.numbers ?? [])],
        situation: target.situation ?? loser.situation,
        stakes: target.stakes ?? loser.stakes,
        result: target.result ?? loser.result,
        reflection: target.reflection ?? loser.reflection,
        evidence: [...(target.evidence ?? []), ...(loser.evidence ?? [])],
        // The stricter of the two wins, so merging can never loosen consent.
        sensitivity: loser.sensitivity === "sensitive" ? "sensitive" : target.sensitivity,
        consentToUse: target.consentToUse && loser.consentToUse,
      })
      .where(and(eq(stories.userId, ownerId), eq(stories.id, keep)))
      .returning();

    await tx
      .update(stories)
      .set({ mergedInto: keep })
      .where(and(eq(stories.userId, ownerId), eq(stories.id, merge)));
    await tx
      .update(goldenLines)
      .set({ storyId: keep })
      .where(and(eq(goldenLines.userId, ownerId), eq(goldenLines.storyId, merge)));

    return updated ?? null;
  });
}

/* Golden lines ------------------------------------------------------------------------------- */

export const NewGoldenLine = z.strictObject({
  storyId: z.guid().nullable().optional(),
  text: shortText(2000),
  english: z.string().trim().max(2000).nullable().optional(),
  sourceId: z.guid().nullable().optional(),
  span: z
    .strictObject({ start: z.int().min(0), end: z.int().min(0) })
    .nullable()
    .optional(),
});

export type NewGoldenLine = z.input<typeof NewGoldenLine>;

export async function createGoldenLines(
  db: Database,
  userId: string,
  incoming: readonly NewGoldenLine[],
): Promise<GoldenLine[]> {
  const ownerId = assertId(userId, "userId");
  const values = incoming.map((entry) => NewGoldenLine.parse(entry));
  if (values.length === 0) return [];

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ code: goldenLines.code, text: goldenLines.text })
      .from(goldenLines)
      .where(eq(goldenLines.userId, ownerId));
    const used = new Set(existing.map((row) => row.code));
    const seen = new Set(existing.map((row) => row.text));
    const created: GoldenLine[] = [];
    for (const entry of values) {
      // The Extractor runs per turn and may offer the same sentence twice; keep one.
      if (seen.has(entry.text)) continue;
      seen.add(entry.text);
      const code = nextCode("line", used);
      used.add(code);
      const [row] = await tx
        .insert(goldenLines)
        .values({
          userId: ownerId,
          code,
          storyId: entry.storyId ?? null,
          text: entry.text,
          english: entry.english ?? null,
          sourceId: entry.sourceId ?? null,
          span: entry.span ?? null,
        })
        .returning();
      if (row) created.push(row);
    }
    return created;
  });
}

export async function listGoldenLines(
  db: DbExecutor,
  userId: string,
  storyId?: string,
): Promise<GoldenLine[]> {
  const ownerId = assertId(userId, "userId");
  return db
    .select()
    .from(goldenLines)
    .where(
      storyId
        ? and(
            eq(goldenLines.userId, ownerId),
            eq(goldenLines.storyId, assertId(storyId, "storyId")),
          )
        : eq(goldenLines.userId, ownerId),
    )
    .orderBy(asc(goldenLines.code));
}

export async function setGoldenLineStarred(
  db: DbExecutor,
  userId: string,
  lineId: string,
  starred: boolean,
): Promise<GoldenLine | null> {
  const [row] = await db
    .update(goldenLines)
    .set({ starred })
    .where(
      and(
        eq(goldenLines.userId, assertId(userId, "userId")),
        eq(goldenLines.id, assertId(lineId, "lineId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* People ------------------------------------------------------------------------------------- */

export const NewPerson = z.strictObject({
  name: shortText(120),
  roleInLife: shortText(120),
  mayName: z.boolean().optional(),
});

export type NewPerson = z.input<typeof NewPerson>;

export async function upsertPeople(
  db: Database,
  userId: string,
  incoming: readonly NewPerson[],
): Promise<Person[]> {
  const ownerId = assertId(userId, "userId");
  const values = incoming.map((entry) => NewPerson.parse(entry));
  if (values.length === 0) return [];

  return db.transaction(async (tx) => {
    const existing = await tx.select().from(people).where(eq(people.userId, ownerId));
    const byName = new Map(existing.map((row) => [row.name.toLowerCase(), row] as const));
    const used = new Set(existing.map((row) => row.code));
    const result: Person[] = [];
    for (const entry of values) {
      const match = byName.get(entry.name.toLowerCase());
      if (match) {
        result.push(match);
        continue;
      }
      const code = nextCode("person", used);
      used.add(code);
      const [row] = await tx
        .insert(people)
        .values({
          userId: ownerId,
          code,
          name: entry.name,
          roleInLife: entry.roleInLife,
          // Spec §8.7: names reach a draft only once the applicant allows it.
          mayName: entry.mayName ?? false,
        })
        .returning();
      if (row) {
        result.push(row);
        byName.set(row.name.toLowerCase(), row);
      }
    }
    return result;
  });
}

export async function listPeople(db: DbExecutor, userId: string): Promise<Person[]> {
  return db
    .select()
    .from(people)
    .where(eq(people.userId, assertId(userId, "userId")))
    .orderBy(asc(people.code));
}

export async function setPersonMayName(
  db: DbExecutor,
  userId: string,
  personId: string,
  mayName: boolean,
): Promise<Person | null> {
  const [row] = await db
    .update(people)
    .set({ mayName })
    .where(
      and(
        eq(people.userId, assertId(userId, "userId")),
        eq(people.id, assertId(personId, "personId")),
      ),
    )
    .returning();
  return row ?? null;
}

/* Brand, voice and goals --------------------------------------------------------------------- */

export async function getBrand(db: DbExecutor, userId: string): Promise<Brand | null> {
  const [row] = await db
    .select()
    .from(brand)
    .where(eq(brand.userId, assertId(userId, "userId")))
    .orderBy(desc(brand.version))
    .limit(1);
  return row ?? null;
}

export const BrandPatch = z.strictObject({
  traits: z
    .array(
      z.strictObject({
        traitId: shortText(60),
        storyCodes: z.array(z.string().max(16)).max(12),
        why: z.string().trim().max(600).optional(),
      }),
    )
    .max(6),
  positioningLine: z.string().trim().max(600).nullable().optional(),
  accepted: z.boolean().optional(),
});

export type BrandPatch = z.input<typeof BrandPatch>;

/** Saves a new brand version; the applicant accepting or editing it marks it accepted (§5.3c). */
export async function saveBrand(db: Database, userId: string, patch: BrandPatch): Promise<Brand> {
  const ownerId = assertId(userId, "userId");
  const values = BrandPatch.parse(patch);
  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: brand.version })
      .from(brand)
      .where(eq(brand.userId, ownerId))
      .orderBy(desc(brand.version))
      .limit(1);
    const [row] = await tx
      .insert(brand)
      .values({
        userId: ownerId,
        version: (latest?.version ?? 0) + 1,
        traits: values.traits as BrandTrait[],
        positioningLine: values.positioningLine ?? null,
        acceptedAt: values.accepted ? new Date() : null,
      })
      .returning();
    if (!row) throw new Error("Failed to save brand");
    return row;
  });
}

export async function getVoiceProfile(
  db: DbExecutor,
  userId: string,
): Promise<VoiceProfile | null> {
  const [row] = await db
    .select()
    .from(voiceProfiles)
    .where(eq(voiceProfiles.userId, assertId(userId, "userId")))
    .limit(1);
  return row ?? null;
}

export async function saveVoiceProfile(
  db: DbExecutor,
  userId: string,
  input: { stats?: VoiceStats | null; card?: string | null },
): Promise<VoiceProfile> {
  const ownerId = assertId(userId, "userId");
  const [row] = await db
    .insert(voiceProfiles)
    .values({ userId: ownerId, stats: input.stats ?? null, card: input.card ?? null })
    .onConflictDoUpdate({
      target: voiceProfiles.userId,
      set: {
        ...(input.stats !== undefined ? { stats: input.stats } : {}),
        ...(input.card !== undefined ? { card: input.card } : {}),
        updatedAt: sql`now()`,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to save voice profile");
  return row;
}

export const GoalsPatch = z
  .strictObject({
    shortTerm: z.string().trim().max(2000).nullable(),
    longTerm: z.string().trim().max(2000).nullable(),
    planB: z.string().trim().max(2000).nullable(),
    whyMba: z.string().trim().max(2000).nullable(),
    whyNow: z.string().trim().max(2000).nullable(),
  })
  .partial();

export type GoalsPatch = z.input<typeof GoalsPatch>;

export async function getGoals(db: DbExecutor, userId: string): Promise<Goals | null> {
  const [row] = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, assertId(userId, "userId")))
    .limit(1);
  return row ?? null;
}

export async function saveGoals(db: DbExecutor, userId: string, patch: GoalsPatch): Promise<Goals> {
  const ownerId = assertId(userId, "userId");
  const values = GoalsPatch.parse(patch);
  const [row] = await db
    .insert(goals)
    .values({ userId: ownerId, ...values })
    .onConflictDoUpdate({
      target: goals.userId,
      set: { ...values, updatedAt: sql`now()` },
    })
    .returning();
  if (!row) throw new Error("Failed to save goals");
  return row;
}

/* Snapshots ---------------------------------------------------------------------------------- */

export async function getLatestSnapshot(
  db: DbExecutor,
  userId: string,
): Promise<DossierSnapshot | null> {
  const [row] = await db
    .select()
    .from(dossierSnapshots)
    .where(eq(dossierSnapshots.userId, assertId(userId, "userId")))
    .orderBy(desc(dossierSnapshots.version))
    .limit(1);
  return row ?? null;
}

/**
 * Assembles the compiler's input from the dossier as it stands. Merged stories are left out;
 * consent is applied by the compiler itself, in one place (packages/shared).
 */
export async function buildDossierInput(db: Database, userId: string): Promise<DossierInput> {
  const ownerId = assertId(userId, "userId");
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, ownerId)).limit(1);
  const [factRows, storyRows, lineRows, personRows, brandRow, voiceRow, goalRow] =
    await Promise.all([
      listFacts(db, ownerId),
      listStories(db, ownerId),
      listGoldenLines(db, ownerId),
      listPeople(db, ownerId),
      getBrand(db, ownerId),
      getVoiceProfile(db, ownerId),
      getGoals(db, ownerId),
    ]);

  const linesByStory = new Map<string, typeof lineRows>();
  for (const line of lineRows) {
    if (!line.storyId) continue;
    linesByStory.set(line.storyId, [...(linesByStory.get(line.storyId) ?? []), line]);
  }
  const peopleByCode = new Map(personRows.map((row) => [row.code, row] as const));

  return {
    applicant: {
      handle: applicantHandle(ownerId),
      programType: profile?.programType ?? "full_time_mba",
      targetIntake: profile?.targetIntake ?? null,
      country: profile?.country ?? null,
      yearsExperience: profile?.yearsExperience ?? null,
      test:
        profile?.testType && profile.testScore != null
          ? { type: profile.testType, score: profile.testScore }
          : null,
      gpa:
        profile?.gpa != null && profile.gpaScale != null
          ? { value: profile.gpa, scale: profile.gpaScale }
          : null,
    },
    facts: factRows.map((row) => ({
      code: row.code,
      key: row.key,
      value: row.value,
      note: row.note,
      status: row.status,
      approvedPhrasing: row.approvedPhrasing,
      sensitivity: row.sensitivity,
      consentToUse: row.consentToUse,
      conflict: row.conflict ?? null,
    })),
    stories: storyRows.map((row) => ({
      code: row.code,
      nickname: row.nickname,
      era: row.era ?? "",
      context: row.context,
      chapter: row.chapter,
      lenses: row.lenses as LensId[],
      traits: row.traits as TraitId[],
      status: row.status,
      situation: row.situation ?? "",
      stakes: row.stakes,
      actions: row.actions,
      result: row.result,
      reflection: row.reflection,
      lines: (linesByStory.get(row.id) ?? [])
        // Starred lines first: the applicant chose them (§5.3b).
        .sort((a, b) => Number(b.starred) - Number(a.starred) || a.code.localeCompare(b.code))
        .map((line) => ({ code: line.code, text: line.text, english: line.english })),
      people: row.peopleCodes
        .map((personCode) => peopleByCode.get(personCode))
        .filter((person): person is NonNullable<typeof person> => person !== undefined)
        .map((person) => ({
          code: person.code,
          name: person.name,
          roleInLife: person.roleInLife,
          mayName: person.mayName,
        })),
      usedIn: [],
      sensitivity: row.sensitivity,
      consentToUse: row.consentToUse,
    })),
    brand: (brandRow?.traits ?? []).map((entry) => ({
      trait: entry.traitId as TraitId,
      stories: entry.storyCodes,
    })),
    voice: voiceRow?.card ? { card: voiceRow.card } : null,
    goals: goalRow
      ? { shortTerm: goalRow.shortTerm, longTerm: goalRow.longTerm, planB: goalRow.planB }
      : null,
  };
}

/** Compiles and stores the next snapshot version (spec §8.2, §8.5.3). */
export async function saveDossierSnapshot(
  db: Database,
  userId: string,
): Promise<{ snapshot: DossierSnapshot; compiled: CompiledDossier }> {
  const ownerId = assertId(userId, "userId");
  const input = await buildDossierInput(db, ownerId);
  const compiled = compileDossier(input);
  const [latest] = await db
    .select({ version: dossierSnapshots.version })
    .from(dossierSnapshots)
    .where(eq(dossierSnapshots.userId, ownerId))
    .orderBy(desc(dossierSnapshots.version))
    .limit(1);
  const [row] = await db
    .insert(dossierSnapshots)
    .values({
      userId: ownerId,
      version: (latest?.version ?? 0) + 1,
      compactText: compiled.text,
      tokenCount: compiled.tokenCount,
      builtFrom: compiled.builtFrom,
    })
    .returning();
  if (!row) throw new Error("Failed to save dossier snapshot");
  return { snapshot: row, compiled };
}
