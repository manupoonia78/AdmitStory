import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { profiles, studioModes } from "../schema";
import { assertId } from "./ids";

export type Profile = typeof profiles.$inferSelect;

function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const shortText = (max: number) => z.string().trim().min(1).max(max);

/**
 * Fields a user may change on their own profile (Settings, first-run). Consent
 * columns are excluded: 18+/terms go through confirmAgeAndTerms. `null` clears
 * a nullable field; omitted keys are left unchanged.
 */
export const ProfilePatch = z
  .strictObject({
    displayName: shortText(80).nullable(),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2 code")
      .nullable(),
    timezone: z.string().trim().refine(isIanaTimeZone, "IANA time zone").nullable(),
    programType: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{1,39}$/, "snake_case program key"),
    targetIntake: z.int().min(2000).max(2100).nullable(),
    yearsExperience: z.number().min(0).max(60).nullable(),
    testType: shortText(32).nullable(),
    testScore: z.int().min(0).max(10_000).nullable(),
    testBreakdown: z.record(shortText(40), z.number().finite()).nullable(),
    gpa: z.number().min(0).max(1000).nullable(),
    gpaScale: z.number().positive().max(1000).nullable(),
    languages: z.array(shortText(64)).max(30),
    studioMode: z.enum(studioModes).nullable(),
    readAloud: z.boolean(),
    toneSetting: shortText(64).nullable(),
    keepAudio: z.boolean(),
    improveProductOptIn: z.boolean(),
    // Phase 1 additions (spec §10, §6.2, §5.1).
    voiceprint: z
      .strictObject({
        version: z.literal(1),
        avgPitchHz: z.number().positive().max(1000),
        paceWpm: z.number().min(0).max(400),
        pitchRangeSemitones: z.number().min(0).max(48),
        pauseRhythm: z.number().min(0).max(1),
        source: z.enum(["voice", "text", "default"]),
      })
      .nullable(),
    voiceprintHue: z.int().min(0).max(11).nullable(),
    theme: z.enum(["system", "night", "day"]),
    uiSounds: z.boolean(),
    targetRounds: z.array(z.enum(["R1", "R2", "R3", "R4", "rolling", "unsure"])).max(4),
  })
  .partial()
  .refine((p) => p.gpa == null || p.gpaScale == null || p.gpa <= p.gpaScale, {
    message: "gpa cannot exceed gpaScale",
    path: ["gpa"],
  });

export type ProfilePatch = z.input<typeof ProfilePatch>;

export async function getProfile(db: DbExecutor, userId: string): Promise<Profile | null> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, assertId(userId, "userId")))
    .limit(1);
  return row ?? null;
}

/** Updates the caller's own profile only. Returns null if the caller has no profile row. */
export async function updateProfile(
  db: DbExecutor,
  userId: string,
  patch: ProfilePatch,
): Promise<Profile | null> {
  const ownerId = assertId(userId, "userId");
  const values = ProfilePatch.parse(patch);
  if (Object.keys(values).length === 0) return getProfile(db, ownerId);
  const [row] = await db
    .update(profiles)
    .set(values)
    .where(eq(profiles.userId, ownerId))
    .returning();
  return row ?? null;
}

/**
 * Records the 18+ confirmation and acceptance of a terms version (spec §14.4,
 * §14.7). The first age confirmation is kept; re-accepting newer terms updates
 * the version and its timestamp.
 */
export async function confirmAgeAndTerms(
  db: DbExecutor,
  userId: string,
  termsVersion: string,
): Promise<Profile | null> {
  const ownerId = assertId(userId, "userId");
  const version = shortText(64).parse(termsVersion);
  const [row] = await db
    .update(profiles)
    .set({
      ageConfirmedAt: sql`coalesce(${profiles.ageConfirmedAt}, now())`,
      termsVersion: version,
      termsAcceptedAt: sql`now()`,
    })
    .where(eq(profiles.userId, ownerId))
    .returning();
  return row ?? null;
}

/**
 * Records that first run is done (spec §5.1). Not part of ProfilePatch: it is a fact about the
 * account's progress, not a preference the user sets, and re-running first run must not move it.
 */
export async function markFirstRunComplete(
  db: DbExecutor,
  userId: string,
): Promise<Profile | null> {
  const [row] = await db
    .update(profiles)
    .set({ firstRunCompletedAt: sql`coalesce(${profiles.firstRunCompletedAt}, now())` })
    .where(eq(profiles.userId, assertId(userId, "userId")))
    .returning();
  return row ?? null;
}
