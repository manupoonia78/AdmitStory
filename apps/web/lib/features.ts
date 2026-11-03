import "server-only";

import { FeatureDisabledError } from "@admitstory/ai";
import { getDb, listFeatureSwitches, type FeatureSwitchRow } from "@admitstory/db";
import { FEATURE_SWITCHES, type FeatureKey } from "@admitstory/shared";

// Kill switches (spec §5.18, Phase 9b decision 5): rows in feature_switches, edited at
// /admin/switches, read through a 15-second in-process cache. A missing row means "on", and a
// database error is treated as "everything on" so a switch read can never take the app down.
// AI features are enforced inside ai.run() (lib/ai.ts hands it disabledTasks()); everything else
// calls assertFeatureOn() at its checkpoint.

const TTL_MS = 15_000;

let cache: { at: number; rows: Promise<FeatureSwitchRow[]> } | null = null;

function rows(): Promise<FeatureSwitchRow[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const load = listFeatureSwitches(getDb()).catch((error: unknown) => {
    console.error("[features] switch read failed; treating every feature as on:", error);
    cache = null;
    return [] as FeatureSwitchRow[];
  });
  cache = { at: Date.now(), rows: load };
  return load;
}

/** Drop the cache (after an admin flips a switch, so this instance sees it at once). */
export function forgetFeatureSwitches(): void {
  cache = null;
}

export async function isFeatureOn(key: FeatureKey): Promise<boolean> {
  const row = (await rows()).find((r) => r.key === key);
  return row ? row.enabled : true;
}

/** Throws FeatureDisabledError (lib/api turns it into a 503 "paused") when the switch is off. */
export async function assertFeatureOn(key: FeatureKey): Promise<void> {
  if (!(await isFeatureOn(key))) throw new FeatureDisabledError(key, "-");
}

/** The AI tasks of every switch that is off, for ai.run(). */
export async function disabledTasks(): Promise<ReadonlySet<string>> {
  const off = (await rows()).filter((r) => !r.enabled);
  return new Set(off.flatMap((r) => FEATURE_SWITCHES[r.key]?.tasks ?? []));
}

/** What the applicant reads while a feature is paused: the admin's line, or the default. */
export async function pausedMessage(key: string): Promise<string> {
  const def = (FEATURE_SWITCHES as Record<string, (typeof FEATURE_SWITCHES)[FeatureKey]>)[key];
  const row = (await rows()).find((r) => r.key === key);
  return (
    row?.message || def?.userMessage || "This is paused for a few minutes. Your work is saved."
  );
}
