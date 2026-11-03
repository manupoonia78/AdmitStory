import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../src/client";
import {
  addSessionVoiceSeconds,
  createStudioSession,
  getProfile,
  getVoiceSettings,
  latestStudioSessionId,
  onUserCreated,
  recordVoiceUsage,
  saveVoiceprint,
  updateVoiceSettings,
  voiceSecondsUsed,
} from "../src/repos";
import { usageLedger } from "../src/schema";
import type { VoiceprintIdentity } from "../src/schema";
import { connectTestDb, createUserFactory } from "./support/db";

// Phase 2 repositories against a real database: voice settings, voice minutes, the voice ledger
// rows and the speech-derived Voiceprint.

let handle: DbHandle;
let factory: ReturnType<typeof createUserFactory>;
const runIds: string[] = [];

beforeAll(async () => {
  handle = await connectTestDb();
  factory = createUserFactory(handle);
});

afterAll(async () => {
  if (!handle) return;
  for (const runId of runIds)
    await handle.db.delete(usageLedger).where(eq(usageLedger.runId, runId));
  await factory.cleanup();
  await handle.pool.end();
});

async function applicant(): Promise<string> {
  const userId = await factory.create();
  await onUserCreated(handle.db, userId);
  return userId;
}

const identity = (source: VoiceprintIdentity["source"], avgPitchHz = 170): VoiceprintIdentity => ({
  version: 1,
  avgPitchHz,
  paceWpm: 150,
  pitchRangeSemitones: 9,
  pauseRhythm: 0.4,
  source,
});

describe("voice settings", () => {
  it("defaults to English, the warm voice at normal speed, read-aloud on", async () => {
    const userId = await applicant();
    expect(await getVoiceSettings(handle.db, userId)).toEqual({
      readAloud: true,
      speechLanguage: "en",
      ttsVoice: "warm",
      ttsSpeed: 1,
    });
  });

  it("updates only the caller's own settings", async () => {
    const [mine, theirs] = [await applicant(), await applicant()];
    const updated = await updateVoiceSettings(handle.db, mine, {
      speechLanguage: "multi",
      ttsSpeed: 0.85,
    });
    expect(updated).toMatchObject({ speechLanguage: "multi", ttsSpeed: 0.85 });
    expect(await getVoiceSettings(handle.db, theirs)).toMatchObject({
      speechLanguage: "en",
      ttsSpeed: 1,
    });
    await expect(updateVoiceSettings(handle.db, mine, { ttsSpeed: 9 })).rejects.toThrow();
  });
});

describe("voice minutes", () => {
  it("adds seconds to the caller's session atomically and sums them across sessions", async () => {
    const userId = await applicant();
    const other = await applicant();
    const [a, b] = [
      await createStudioSession(handle.db, userId, { mode: "standard" }),
      await createStudioSession(handle.db, userId, { mode: "express" }),
    ];
    await Promise.all([
      addSessionVoiceSeconds(handle.db, userId, a.id, 30),
      addSessionVoiceSeconds(handle.db, userId, a.id, 45.4),
      addSessionVoiceSeconds(handle.db, userId, b.id, 60),
    ]);
    expect(await voiceSecondsUsed(handle.db, userId)).toBe(135);
    // Someone else's session is not theirs to add to.
    expect(await addSessionVoiceSeconds(handle.db, other, a.id, 100)).toBeNull();
    expect(await voiceSecondsUsed(handle.db, userId)).toBe(135);
    expect(await voiceSecondsUsed(handle.db, other)).toBe(0);
  });

  it("finds the caller's latest Studio session, for dictation outside the Studio", async () => {
    const userId = await applicant();
    const other = await applicant();
    expect(await latestStudioSessionId(handle.db, userId)).toBeNull();
    await createStudioSession(handle.db, userId, { mode: "standard" });
    const latest = await createStudioSession(handle.db, userId, { mode: "express" });
    await createStudioSession(handle.db, other, { mode: "standard" });
    expect(await latestStudioSessionId(handle.db, userId)).toBe(latest.id);
  });

  it("writes voice ledger rows with seconds, characters and the provider as the model", async () => {
    const userId = await applicant();
    const stt = {
      runId: randomUUID(),
      userId,
      task: "voice.stt" as const,
      model: "deepgram",
      sttSeconds: 41.5,
      ttsChars: 0,
      costUsd: 0.00332,
      latencyMs: 0,
      aiMode: "live" as const,
    };
    const tts = {
      ...stt,
      runId: randomUUID(),
      task: "voice.tts" as const,
      model: "cartesia",
      sttSeconds: 0,
      ttsChars: 120,
      costUsd: 0.0048,
      latencyMs: 210,
    };
    runIds.push(stt.runId, tts.runId);
    await recordVoiceUsage(handle.db, stt);
    await recordVoiceUsage(handle.db, tts);
    const rows = await handle.db.select().from(usageLedger).where(eq(usageLedger.userId, userId));
    expect(
      rows.map((r) => [r.task, r.model, r.servedModel, r.sttSeconds, r.ttsChars, r.costUsd]).sort(),
    ).toEqual([
      ["voice.stt", "deepgram", "deepgram", 41.5, 0, 0.00332],
      ["voice.tts", "cartesia", "cartesia", 0, 120, 0.0048],
    ]);
    await expect(
      recordVoiceUsage(handle.db, { ...stt, runId: randomUUID(), costUsd: -1 }),
    ).rejects.toThrow();
  });
});

describe("speech-derived Voiceprint (§6.2)", () => {
  it("replaces a text seed, and nothing replaces it afterwards", async () => {
    const userId = await applicant();
    expect(await saveVoiceprint(handle.db, userId, identity("text", 160))).toBe(true);
    expect(await saveVoiceprint(handle.db, userId, identity("voice", 190))).toBe(true);
    expect((await getProfile(handle.db, userId))?.voiceprint).toMatchObject({
      source: "voice",
      avgPitchHz: 190,
    });
    expect(await saveVoiceprint(handle.db, userId, identity("text", 150))).toBe(false);
    expect(await saveVoiceprint(handle.db, userId, identity("voice", 120))).toBe(false);
    expect((await getProfile(handle.db, userId))?.voiceprint).toMatchObject({
      source: "voice",
      avgPitchHz: 190,
    });
  });

  it("accepts derived numbers only", async () => {
    const userId = await applicant();
    await expect(
      saveVoiceprint(handle.db, userId, { ...identity("voice"), audio: "x" } as VoiceprintIdentity),
    ).rejects.toThrow();
  });
});
