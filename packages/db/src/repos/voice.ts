// Voice settings, voice minutes and the speech-derived Voiceprint (spec §5.1, §6.2, §12.4).
// Every statement is scoped to the owner, like the rest of the repositories.

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "../client";
import { profiles, studioSessions, type VoiceprintIdentity } from "../schema";
import { assertId } from "./ids";

export interface VoiceSettingsRow {
  readAloud: boolean;
  speechLanguage: string;
  ttsVoice: string;
  ttsSpeed: number;
}

/**
 * The shape of each setting. Which languages and voices exist is packages/voice's contract, which
 * the route validates against; this guards the columns themselves.
 */
export const VoiceSettingsPatch = z
  .strictObject({
    readAloud: z.boolean(),
    speechLanguage: z.string().regex(/^(multi|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$/, "BCP 47 tag"),
    ttsVoice: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, "voice id"),
    ttsSpeed: z.number().min(0.5).max(2),
  })
  .partial();

export type VoiceSettingsPatch = z.input<typeof VoiceSettingsPatch>;

const settingsColumns = {
  readAloud: profiles.readAloud,
  speechLanguage: profiles.speechLanguage,
  ttsVoice: profiles.ttsVoice,
  ttsSpeed: profiles.ttsSpeed,
};

export async function getVoiceSettings(
  db: DbExecutor,
  userId: string,
): Promise<VoiceSettingsRow | null> {
  const [row] = await db
    .select(settingsColumns)
    .from(profiles)
    .where(eq(profiles.userId, assertId(userId, "userId")))
    .limit(1);
  return row ?? null;
}

export async function updateVoiceSettings(
  db: DbExecutor,
  userId: string,
  patch: VoiceSettingsPatch,
): Promise<VoiceSettingsRow | null> {
  const ownerId = assertId(userId, "userId");
  const values = VoiceSettingsPatch.parse(patch);
  if (Object.keys(values).length === 0) return getVoiceSettings(db, ownerId);
  const [row] = await db
    .update(profiles)
    .set(values)
    .where(eq(profiles.userId, ownerId))
    .returning(settingsColumns);
  return row ?? null;
}

/** Lifetime voice seconds across the applicant's Studio sessions (§12.4's 120 free minutes). */
export async function voiceSecondsUsed(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${studioSessions.voiceSeconds}), 0)` })
    .from(studioSessions)
    .where(eq(studioSessions.userId, assertId(userId, "userId")));
  return Number(row?.total ?? 0);
}

/**
 * Adds dictated seconds to a session in one statement, so two answers landing together both count.
 * Returns the session's new total, or null when the session is not the caller's.
 */
export async function addSessionVoiceSeconds(
  db: DbExecutor,
  userId: string,
  sessionId: string,
  seconds: number,
): Promise<number | null> {
  const add = z
    .int()
    .min(0)
    .max(24 * 60 * 60)
    .parse(Math.round(seconds));
  const [row] = await db
    .update(studioSessions)
    .set({ voiceSeconds: sql`${studioSessions.voiceSeconds} + ${add}` })
    .where(
      and(
        eq(studioSessions.userId, assertId(userId, "userId")),
        eq(studioSessions.id, assertId(sessionId, "sessionId")),
      ),
    )
    .returning({ voiceSeconds: studioSessions.voiceSeconds });
  return row?.voiceSeconds ?? null;
}

/**
 * The applicant's most recent Studio session. Dictation outside the Studio (the Dossier's
 * add-detail) is counted on it, so every dictated second counts against the free minutes.
 */
export async function latestStudioSessionId(
  db: DbExecutor,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: studioSessions.id })
    .from(studioSessions)
    .where(eq(studioSessions.userId, assertId(userId, "userId")))
    .orderBy(desc(studioSessions.startedAt))
    .limit(1);
  return row?.id ?? null;
}

export const VoiceprintIdentitySchema = z.strictObject({
  version: z.literal(1),
  avgPitchHz: z.number().min(50).max(500),
  paceWpm: z.number().min(0).max(400),
  pitchRangeSemitones: z.number().min(0).max(48),
  pauseRhythm: z.number().min(0).max(1),
  source: z.enum(["voice", "text", "default"]),
}) satisfies z.ZodType<VoiceprintIdentity>;

/**
 * Stores a Voiceprint identity unless a speech-derived one is already there (§6.2: computed once
 * from the first minutes of speech, or seeded from writing for someone who never speaks). So
 * speech replaces a text seed, and nothing replaces speech. The condition is in the UPDATE itself,
 * so a text seed written by a background consolidation can never land on top of a voice identity
 * saved a moment earlier. Returns whether it was stored.
 */
export async function saveVoiceprint(
  db: DbExecutor,
  userId: string,
  identity: VoiceprintIdentity,
): Promise<boolean> {
  const value = VoiceprintIdentitySchema.parse(identity);
  const rows = await db
    .update(profiles)
    .set({ voiceprint: value })
    .where(
      and(
        eq(profiles.userId, assertId(userId, "userId")),
        or(isNull(profiles.voiceprint), sql`${profiles.voiceprint}->>'source' <> 'voice'`),
      ),
    )
    .returning({ id: profiles.id });
  return rows.length > 0;
}
