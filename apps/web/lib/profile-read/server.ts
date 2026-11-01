import "server-only";

import { MODEL_IDS, ROUTES } from "@admitstory/ai";
import {
  getDb,
  getLatestProfileRead,
  getLatestSnapshot,
  listFacts,
  listGoldenLines,
  listStories,
  saveProfileRead,
  type DossierSnapshot,
} from "@admitstory/db";
import type { CoverageLevel, LensId } from "@admitstory/shared";
import { compareToMedian } from "@admitstory/shared/kit";
import { ai } from "@/lib/ai";
import { loadKnowledge } from "@/lib/studio/state";
import { loadApplicant, loadUserSchools } from "@/lib/strategy/server";
import { ensureSnapshot } from "@/lib/strategy/jobs";
import { shouldBuild, type BuildDecision, type BuildReason, type ReadBasis } from "./policy";
import { readStoredRead, type StoredRead, type ViewFact, type ViewStory } from "./view";

// Profile Read (spec §5.4, §8.5.4): profile.read over the applicant's dossier snapshot, with their
// numbers against each target school's medians computed in code. Rebuilt by the profile-read
// Inngest function, which applies the once-a-day rule in policy.ts.

export function basisOf(snapshot: Pick<DossierSnapshot, "builtFrom">): ReadBasis {
  return {
    storyCodes: snapshot.builtFrom?.storyCodes ?? [],
    factCodes: snapshot.builtFrom?.factCodes ?? [],
  };
}

export type ProfileReadRun =
  | { status: "saved"; version: number }
  | { status: "skipped"; why: Extract<BuildDecision, { build: false }>["why"] };

export async function runProfileRead(userId: string, reason: BuildReason): Promise<ProfileReadRun> {
  const db = getDb();
  const [snapshot, latest, stories] = await Promise.all([
    ensureSnapshot(userId),
    getLatestProfileRead(db, userId),
    listStories(db, userId),
  ]);
  const stored = latest ? readStoredRead(latest.content) : null;
  const decision = shouldBuild({
    reason,
    latest: latest
      ? {
          createdAt: latest.createdAt,
          snapshotVersion: latest.builtFromSnapshotVersion,
          basis: stored?.basis ?? null,
        }
      : null,
    snapshot: { version: snapshot.version, basis: basisOf(snapshot) },
    storyCount: stories.filter((s) => s.mergedInto === null).length,
    now: new Date(),
  });
  if (!decision.build) return { status: "skipped", why: decision.why };

  // The applicant's numbers against each target with a published class profile (code, not model).
  const [applicant, schools] = await Promise.all([
    loadApplicant(userId),
    loadUserSchools(db, userId),
  ]);
  const targets = schools
    .filter((s) => s.pack?.class_profile?.verified_at)
    .slice(0, 12)
    .map((s) => ({
      school: s.row.school.name,
      medians: compareToMedian(applicant.numbers, s.pack?.class_profile ?? {}),
    }));

  const read = await ai().run(
    "profile.read",
    { targets },
    { userId, dossier: snapshot.compactText },
  );
  await ai().flush();
  const content: StoredRead = { read, basis: basisOf(snapshot) };
  const row = await saveProfileRead(db, userId, {
    content: content as unknown as Record<string, unknown>,
    builtFromSnapshotVersion: snapshot.version,
    model: MODEL_IDS[ROUTES["profile.read"].model],
  });
  return { status: "saved", version: row.version };
}

/** Everything screen D needs, read in one place for the page and GET /api/profile/read. */
export interface ProfileReadData {
  read: StoredRead | null;
  version: number | null;
  builtAt: string | null;
  stories: ViewStory[];
  facts: ViewFact[];
  levels: Partial<Record<LensId, CoverageLevel>>;
  /** The dossier has moved on since the read was built (it will rebuild on its own, at most daily). */
  behind: boolean;
}

export async function loadProfileRead(userId: string): Promise<ProfileReadData> {
  const db = getDb();
  const [row, stories, facts, lines, knowledge, snapshot] = await Promise.all([
    getLatestProfileRead(db, userId),
    listStories(db, userId),
    listFacts(db, userId),
    listGoldenLines(db, userId),
    loadKnowledge(userId),
    getLatestSnapshot(db, userId),
  ]);
  const levels: Partial<Record<LensId, CoverageLevel>> = {};
  for (const bar of knowledge.coverage)
    if (bar.id !== "goals" && bar.id !== "school_fit") levels[bar.id] = bar.level;
  return {
    read: row ? readStoredRead(row.content) : null,
    version: row?.version ?? null,
    builtAt: row?.createdAt.toISOString() ?? null,
    stories: stories
      .filter((s) => s.mergedInto === null && s.consentToUse)
      .map((s) => ({
        id: s.id,
        code: s.code,
        nickname: s.nickname,
        era: s.era ?? "",
        chapter: s.chapter ?? "",
        lenses: s.lenses,
        situation: s.situation,
        lineCodes: lines.filter((l) => l.storyId === s.id).map((l) => l.code),
      })),
    facts: facts
      .filter((f) => f.consentToUse)
      .map((f) => ({ id: f.id, code: f.code, key: f.key, value: f.value })),
    levels,
    behind:
      row !== null &&
      snapshot !== null &&
      row.builtFromSnapshotVersion !== null &&
      snapshot.version > row.builtFromSnapshotVersion,
  };
}
