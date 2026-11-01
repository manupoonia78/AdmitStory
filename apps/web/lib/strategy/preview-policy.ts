// When a kit preview is built, reused or refused (spec §5.5, Manu 2026-10-31): one free preview per
// school, counted against the free AI cap, reused while the dossier snapshot it was built from is
// still the latest (and the pack version is the same). A school without a published pack is never
// previewed. Pure, so the route, the Inngest function and the tests agree.

import { previewJobActive, type PreviewJob } from "./stored-fit";

export interface PreviewFacts {
  /** The school has a published pack ("Pack coming soon" otherwise). */
  published: boolean;
  packVersion: number | null;
  /** The newest dossier snapshot version, or null when none has been compiled yet. */
  snapshotVersion: number | null;
  kit: { dossierSnapshotVersion: number | null; packVersion: number | null } | null;
  job: PreviewJob | null;
  now: Date;
}

export type PreviewDecision = "coming_soon" | "reuse" | "running" | "generate";

/** True when the stored preview was built from the current snapshot and pack version. */
export function previewCurrent(facts: PreviewFacts): boolean {
  const { kit } = facts;
  return (
    kit !== null &&
    kit.dossierSnapshotVersion !== null &&
    kit.dossierSnapshotVersion === facts.snapshotVersion &&
    kit.packVersion === facts.packVersion
  );
}

export function previewDecision(facts: PreviewFacts): PreviewDecision {
  if (!facts.published) return "coming_soon";
  if (previewCurrent(facts)) return "reuse";
  if (previewJobActive(facts.job, facts.now)) return "running";
  return "generate";
}
