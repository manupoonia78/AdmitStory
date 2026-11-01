import type { StatusTone } from "@admitstory/ui";

/** A source's ingestion stage in words (spec §9.3); colour never carries it alone. */
export const SOURCE_STATUS: Record<
  "pending" | "extracting" | "embedding" | "normalizing" | "ready" | "failed",
  { tone: StatusTone; label: string }
> = {
  pending: { tone: "neutral", label: "Waiting to be read" },
  extracting: { tone: "neutral", label: "Reading" },
  embedding: { tone: "neutral", label: "Embedding" },
  normalizing: { tone: "neutral", label: "Normalising" },
  ready: { tone: "verified", label: "Ready" },
  failed: { tone: "risk", label: "Failed" },
};
