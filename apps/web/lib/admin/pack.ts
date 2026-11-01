// Pure helpers between the database rows and packages/kb's pack logic (spec §9.2, §9.3): the
// skeleton a new cycle's pack starts from, a kb_sources row as a pack source, the Normalizer's
// output as kb_proposals rows, a stored proposal as something applyProposals() takes, and the URL
// allowlist for ingestion and the refresh checker (§14.6). No I/O, so all of it is unit-tested.

import type { KbNormalizeOutput } from "@admitstory/ai";
import type { KbProposal, KbSource, NewProposal, School } from "@admitstory/db";
import {
  detectConflicts,
  type AcceptedProposal,
  type FieldConflict,
  type PackProposal,
  type PackSource,
  type SchoolPack,
} from "@admitstory/kb";
import { SchoolPackSchema } from "@admitstory/kb";
import { AdminActionError } from "./errors";

/** `YYYY-MM-DD` in UTC: the review date that becomes `verified_at`. */
export function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Parses pack JSON, or null when it isn't a valid pack (a hand-made partial draft). */
export function tryParsePack(data: unknown): SchoolPack | null {
  const parsed = SchoolPackSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * An empty draft for a cycle with nothing yet. Every list empty, the AI policy `unknown` and
 * unverified, and a `_todo` naming what to fill. The school's identity must be known first: the
 * pack schema needs a country, city and website, and those are school facts we never invent.
 */
export function skeletonPack(school: School, cycle: string): SchoolPack {
  const missing = [
    school.country ? null : "country",
    school.city ? null : "city",
    school.website ? null : "website",
  ].filter((field): field is string => field !== null);
  if (missing.length > 0)
    throw new AdminActionError(
      `Add ${school.shortName}'s ${missing.join(", ")} on its school page before starting a pack.`,
    );
  const pack: SchoolPack = {
    school: {
      id: school.slug,
      name: school.name,
      short_name: school.shortName,
      country: school.country ?? "",
      city: school.city ?? "",
      website: school.website ?? "",
      program: "full_time_mba",
    },
    cycle,
    version: 1,
    status: "draft",
    _todo: [
      "official_urls: the prompts, deadlines, class profile, employment report and AI policy pages",
      "rounds",
      "application.essays",
      "ai_policy",
    ],
    k_high_water: 1,
    sources: [],
    official_urls: [],
    rounds: [],
    application: {
      essays: [],
      short_answers: [],
      goal_fields: [],
      video: [],
      reapplicant: null,
      optional_essay: null,
      form_sections: [],
      recommendations: null,
      resume: null,
      test_policy: [],
      fees_waivers: [],
    },
    values: { stated: [], trait_map: [] },
    culture_and_location: [],
    academics: { courses: [], centers: [], experiential: [], structure: [] },
    community: { clubs: [], traditions: [], treks_events: [] },
    careers: { employment_report: null, recruiting_notes: [] },
    class_profile: null,
    interview: null,
    ai_policy: {
      id: "K01",
      source_ids: [],
      verified_at: null,
      stance: "unknown",
      applies_to: [],
      disclosure_text: null,
      notes: [],
    },
    scholarships: [],
    insider_notes: [],
    avoid: [],
    angles_that_work: [],
    glossary: [],
  };
  return SchoolPackSchema.parse(pack);
}

/** A kb_sources row as the pack's own source registry entry (`sources[]`). */
export function packSourceFor(source: KbSource): PackSource {
  const retrieved = source.verifiedAt ?? source.createdAt;
  return {
    id: source.id,
    type: source.type,
    title: source.title.slice(0, 300),
    url: source.url,
    trust: source.trust,
    retrieved_at: isoDay(retrieved),
    rights_note: source.rightsNote,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseJsonValue(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** The stored conflict record: every candidate with its trust, and what decides it. */
export function conflictRecord(conflict: FieldConflict): NonNullable<NewProposal["conflict"]> {
  const choice =
    conflict.defaultChoice === null ? null : conflict.candidates[conflict.defaultChoice];
  return {
    values: conflict.candidates.slice(0, 10).map((candidate) => {
      const sourceId = candidate.sourceIds.find((id) => UUID.test(id)) ?? null;
      return {
        value: candidate.value,
        sourceId,
        trust: candidate.trust >= 1 && candidate.trust <= 5 ? candidate.trust : null,
      };
    }),
    note: conflict.blocking
      ? "No single official value: choose one. The field stays unchanged until you do."
      : `The official value wins by default (${choice?.origin === "current" ? "the current value" : "the proposed value"}).`,
  };
}

export interface NormalizedSource {
  source: KbSource;
  /** The extracted text the spans point into. */
  text: string;
  cycleId: string;
  packId: string | null;
  /** The draft as it was when the Normalizer read it; null when it isn't a valid pack yet. */
  pack: SchoolPack | null;
}

/**
 * The Normalizer's output as `kb_proposals` rows (§9.3): values decoded from JSON, the source span
 * kept as evidence with its quote, and conflicts with the current values detected in code with
 * every candidate's trust, rather than trusting the model's `conflict` flag alone.
 */
export function proposalRows(output: KbNormalizeOutput, from: NormalizedSource): NewProposal[] {
  const packProposals: PackProposal[] = output.proposals.map((p) => ({
    field_path: p.field_path,
    proposed: parseJsonValue(p.proposed),
    current: parseJsonValue(p.current),
    confidence: p.confidence,
    source_id: from.source.id,
  }));
  const conflicts = from.pack
    ? detectConflicts(from.pack, packProposals, { sources: [packSourceFor(from.source)] })
    : [];
  const conflictFor = new Map<number, FieldConflict>();
  for (const conflict of conflicts)
    for (const candidate of conflict.candidates)
      if (candidate.proposalIndex !== null) conflictFor.set(candidate.proposalIndex, conflict);

  return output.proposals.map((p, index) => {
    const span = p.source_span;
    const conflict = conflictFor.get(index);
    const modelOnly =
      !conflict && p.conflict
        ? {
            values: [
              { value: parseJsonValue(p.current), sourceId: null, trust: null },
              {
                value: parseJsonValue(p.proposed),
                sourceId: from.source.id,
                trust: from.source.trust,
              },
            ],
            note: "The Normalizer flagged a disagreement with the current value.",
          }
        : null;
    return {
      sourceId: from.source.id,
      cycleId: from.cycleId,
      packId: from.packId,
      fieldPath: p.field_path,
      proposed: packProposals[index]?.proposed ?? null,
      current: packProposals[index]?.current ?? null,
      confidence: Math.min(Math.max(p.confidence, 0), 1),
      evidence:
        span && span.end > span.start
          ? [
              {
                start: span.start,
                end: Math.min(span.end, from.text.length),
                quote: from.text.slice(span.start, span.end).slice(0, 2000),
              },
            ]
          : null,
      conflict: conflict ? conflictRecord(conflict) : modelOnly,
    };
  });
}

/** True for a refresh-checker review item: it points at a page, not at an ingested source. */
export function isRefreshItem(row: Pick<KbProposal, "sourceId">): boolean {
  return row.sourceId === null;
}

/** A stored proposal as applyProposals() takes it, with the admin's edit and override. */
export function acceptedProposal(
  row: KbProposal,
  options: { edited?: unknown; override?: boolean } = {},
): AcceptedProposal {
  if (row.sourceId === null) throw new AdminActionError("A refresh check has no value to apply.");
  return {
    field_path: row.fieldPath,
    proposed: options.edited !== undefined ? options.edited : row.proposed,
    current: row.current,
    confidence: row.confidence,
    source_id: row.sourceId,
    ...(options.override ? { override: true } : {}),
  };
}

/** The pending fields still waiting for a decision, as the publish button says it. */
export function pendingLabel(count: number): string {
  return count === 1 ? "1 field still needs a decision" : `${count} fields still need a decision`;
}

/* URL allowlist (§14.6) -------------------------------------------------------------------- */

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.hostname.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

/**
 * The hosts URL ingestion may fetch for a school: its website's host (with and without `www.`)
 * and the hosts of the pack's `official_urls`. Nothing else, and never a wildcard.
 */
export function allowedHosts(
  website: string | null,
  officialUrls: readonly { url: string }[] = [],
): string[] {
  const hosts = new Set<string>();
  const site = hostOf(website);
  if (site) {
    hosts.add(site);
    hosts.add(site.startsWith("www.") ? site.slice(4) : `www.${site}`);
  }
  for (const entry of officialUrls) {
    const host = hostOf(entry.url);
    if (host) hosts.add(host);
  }
  return [...hosts].sort();
}

/** The official URLs of a pack's data, whatever state the draft is in. */
export function officialUrlsOf(data: unknown): { kind: string; url: string }[] {
  if (typeof data !== "object" || data === null) return [];
  const list = (data as { official_urls?: unknown }).official_urls;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) =>
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as { url?: unknown }).url === "string" &&
    typeof (entry as { kind?: unknown }).kind === "string"
      ? [{ kind: (entry as { kind: string }).kind, url: (entry as { url: string }).url }]
      : [],
  );
}
