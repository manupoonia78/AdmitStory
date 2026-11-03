import "server-only";

import {
  addSessionVoiceSeconds,
  getDb,
  latestStudioSessionId,
  listFacts,
  listPeople,
  recordVoiceUsage,
  voiceSecondsUsed,
  type Profile,
} from "@admitstory/db";
import { SEED_SCHOOLS } from "@admitstory/shared";
import {
  DEFAULT_VOICE_SETTINGS,
  FREE_VOICE_SECONDS,
  buildKeyterms,
  createMemoryTtsCache,
  employersFromFacts,
  selectSttProvider,
  selectTtsProvider,
  sttLedgerEntry,
  ttsLedgerEntry,
  type STTProvider,
  type TTSProvider,
  type TtsCache,
  type VoiceSettings,
} from "@admitstory/voice";
import { isLocalAppUrl } from "@/lib/env";
import { studioSchools } from "@/lib/studio/schools";
import { SpeechLanguageSchema, TtsSpeedSchema, TtsVoiceSchema } from "./schemas";

// The voice plumbing the routes share (spec §7.5, §12.4): which providers run, the applicant's
// voice settings, their remaining free minutes, dictation keyterms, and metering.

interface VoiceProviders {
  stt: STTProvider;
  tts: TTSProvider;
  ttsCache: TtsCache;
}

const globalForVoice = globalThis as typeof globalThis & { __admitstoryVoice?: VoiceProviders };

/** The process's providers and read-aloud cache, chosen from the environment once. */
export function voiceProviders(): VoiceProviders {
  globalForVoice.__admitstoryVoice ??= {
    stt: selectSttProvider(),
    tts: selectTtsProvider(),
    ttsCache: createMemoryTtsCache(),
  };
  return globalForVoice.__admitstoryVoice;
}

/** Tests swap in their own providers; `null` returns to the environment's. */
export function setVoiceProviders(providers: Partial<VoiceProviders> | null): void {
  globalForVoice.__admitstoryVoice = providers ? { ...voiceProviders(), ...providers } : undefined;
}

/**
 * The fakes exist for development: a deployed app without a provider key must say voice is
 * unavailable, not point a browser at localhost or read questions aloud as a tone.
 */
export function fakeProvidersAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const appUrl = process.env.APP_URL;
  return appUrl !== undefined && isLocalAppUrl(appUrl);
}

/** The profile's voice columns as the contract's values; anything unrecognised is the default. */
export function voiceSettingsOf(
  profile: Pick<Profile, "readAloud" | "speechLanguage" | "ttsVoice" | "ttsSpeed">,
): VoiceSettings {
  const language = SpeechLanguageSchema.safeParse(profile.speechLanguage);
  const voice = TtsVoiceSchema.safeParse(profile.ttsVoice);
  const speed = TtsSpeedSchema.safeParse(Number(profile.ttsSpeed));
  return {
    readAloud: profile.readAloud,
    speechLanguage: language.success ? language.data : DEFAULT_VOICE_SETTINGS.speechLanguage,
    ttsVoice: voice.success ? voice.data : DEFAULT_VOICE_SETTINGS.ttsVoice,
    ttsSpeed: speed.success ? speed.data : DEFAULT_VOICE_SETTINGS.ttsSpeed,
  };
}

/**
 * Free voice seconds left. Every applicant is on the free allowance until Phase 4 adds
 * entitlements (§12.4: 120 minutes, then the Studio continues in text).
 */
export async function remainingVoiceSeconds(userId: string): Promise<number> {
  return Math.max(0, FREE_VOICE_SECONDS - (await voiceSecondsUsed(getDb(), userId)));
}

/**
 * Keyterms from the dossier: employers and people's names only, then MBA terms, then the
 * applicant's own schools ahead of the Appendix H list (Phase 3: from the schools table).
 */
export async function keytermsFor(userId: string): Promise<string[]> {
  const db = getDb();
  const [facts, people, schools] = await Promise.all([
    listFacts(db, userId),
    listPeople(db, userId),
    studioSchools(userId),
  ]);
  return buildKeyterms({
    employers: employersFromFacts(facts),
    people: people.map((person) => person.name),
    schools: [...schools.schoolNames, ...SEED_SCHOOLS.map((school) => school.name)],
  });
}

/** One dictated answer's seconds: onto the session (the free allowance) and into the ledger. */
export async function meterDictation(
  userId: string,
  sessionId: string,
  seconds: number,
): Promise<void> {
  if (seconds <= 0) return;
  const db = getDb();
  await addSessionVoiceSeconds(db, userId, sessionId, seconds);
  await recordVoiceUsage(db, sttLedgerEntry(userId, voiceProviders().stt.name, seconds));
}

/**
 * Dictation outside a Studio session (the Dossier's add-detail): counted on the applicant's latest
 * session, so it comes out of the free minutes like any other, and into the ledger.
 */
export async function meterLooseDictation(userId: string, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const db = getDb();
  const sessionId = await latestStudioSessionId(db, userId);
  if (sessionId) await addSessionVoiceSeconds(db, userId, sessionId, seconds);
  await recordVoiceUsage(db, sttLedgerEntry(userId, voiceProviders().stt.name, seconds));
}

/** A fresh synthesis's characters into the ledger. A cached replay costs nothing and is not metered. */
export async function meterSpeech(
  userId: string,
  provider: TTSProvider["name"],
  chars: number,
  latencyMs: number,
): Promise<void> {
  await recordVoiceUsage(getDb(), ttsLedgerEntry(userId, provider, chars, latencyMs));
}
