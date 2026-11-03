import { createHash } from "node:crypto";
import { buildCanonLibrary, parseCanonDoc, type CanonDoc, type CanonLibrary } from "../canon";
import type { RouteTask } from "../routing";
import { parsePromptFile, type PromptSource, type PromptTemplate } from "./registry";

/**
 * The registry overlay (spec §5.18, §8.3 "routing is data", §9.4): prompt versions, their A/B
 * weights, route overrides and canon documents published from the admin console, read at run
 * time and laid over the files in the repo. The files stay the seed and the fallback: an agent
 * with nothing published runs its highest file version on the routing table, as before.
 *
 * The database implementation lives in apps/web (packages/db `prompt_versions`, `canon_docs`);
 * this module only defines the shape and resolves it, so packages/ai never imports the database.
 *
 * Cache stability (§8.2): an overlay changes the cached prefix only when its content changes.
 * Templates are parsed exactly as files are, canon documents are ordered by slug whatever order
 * they arrive in, and the same published content always compiles to the same bytes.
 */

/** One published prompt version (a `prompt_versions` row). */
export interface OverlayPromptVersion {
  /** 3 or "v3". */
  version: number | string;
  /** The template as published: front matter and body, the same format as `prompts/<agent>/v<N>.md`. */
  template: string;
  /** Active versions share the agent's traffic by `abWeight`. */
  active: boolean;
  /** Share of traffic among the agent's active versions, 0–100. */
  abWeight: number;
  /** Route override applied whenever this version serves a call (`prompt_versions.route_override`). */
  routeOverride?: Record<string, unknown> | null;
}

/** One published canon document (a `canon_docs` row): the full markdown with front matter. */
export interface OverlayCanonDoc {
  slug: string;
  version: number;
  content: string;
}

export interface RegistryOverlay {
  /** Published versions of one agent's prompt, active or not. */
  promptVersions(agent: string): Promise<readonly OverlayPromptVersion[]>;
  /** Published canon documents. Several versions of a slug may be given: the highest wins. */
  canonDocs(): Promise<readonly OverlayCanonDoc[]>;
  /** Task-level route overrides, validated by resolveRoute() when used. */
  routeOverrides(): Promise<Partial<Record<RouteTask, unknown>>>;
}

export interface RegistryOverlaySource {
  promptVersions?: (agent: string) => Promise<readonly OverlayPromptVersion[]>;
  canonDocs?: () => Promise<readonly OverlayCanonDoc[]>;
  routeOverrides?: () => Promise<Partial<Record<RouteTask, unknown>>>;
  /**
   * How long each answer is reused, in ms (default 60 s, so a publish shows up within a minute,
   * the Phase 3 AC). 0 reads the source on every call.
   */
  ttlMs?: number;
  /** Clock for the TTL (tests). */
  now?: () => number;
}

export const OVERLAY_TTL_MS = 60_000;

/**
 * A RegistryOverlay from plain async functions; a missing function means "nothing published".
 * Answers are cached for `ttlMs`, and a failed read is never cached, so the next call retries.
 */
export function createRegistryOverlay(source: RegistryOverlaySource): RegistryOverlay {
  const ttl = source.ttlMs ?? OVERLAY_TTL_MS;
  const now = source.now ?? Date.now;
  const cache = new Map<string, { at: number; value: Promise<unknown> }>();

  function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && ttl > 0 && now() - hit.at < ttl) return hit.value as Promise<T>;
    const value = load();
    cache.set(key, { at: now(), value });
    value.catch(() => cache.delete(key));
    return value;
  }

  return {
    promptVersions: (agent) =>
      cached(`prompt:${agent}`, async () =>
        source.promptVersions ? source.promptVersions(agent) : [],
      ),
    canonDocs: () => cached("canon", async () => (source.canonDocs ? source.canonDocs() : [])),
    routeOverrides: () =>
      cached("routes", async () => (source.routeOverrides ? source.routeOverrides() : {})),
  };
}

/** "v3" → 3; 3 → 3. Throws on anything else. */
export function overlayVersionNumber(version: number | string): number {
  const n = typeof version === "number" ? version : Number(/^v?([1-9]\d*)$/.exec(version)?.[1]);
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid prompt version "${version}"`);
  return n;
}

function parseOverlayTemplate(agent: string, row: OverlayPromptVersion): PromptTemplate {
  const version = overlayVersionNumber(row.version);
  const label = `prompt_versions ${agent}@v${version}`;
  const template = parsePromptFile(row.template, label);
  if (template.agent !== agent)
    throw new Error(`${label}: header agent "${template.agent}" must be "${agent}"`);
  if (template.version !== version)
    throw new Error(`${label}: header version ${template.version} must be ${version}`);
  return template;
}

/**
 * The files' templates with the overlay's laid over them: a published version replaces the file of
 * the same number and adds the ones the repo does not have.
 */
export function overlayPromptSource(files: PromptSource, overlay: RegistryOverlay): PromptSource {
  return {
    async versions(agent) {
      const [base, rows] = await Promise.all([
        files.versions(agent),
        overlay.promptVersions(agent),
      ]);
      if (rows.length === 0) return base;
      const byVersion = new Map(base.map((template) => [template.version, template]));
      for (const row of rows) {
        const template = parseOverlayTemplate(agent, row);
        byVersion.set(template.version, template);
      }
      return Object.freeze([...byVersion.values()].sort((a, b) => a.version - b.version));
    },
  };
}

export interface ActiveVersion {
  version: number;
  routeOverride: Record<string, unknown> | null;
}

/**
 * A stable number in [0, 1) for a user and an agent: the same user always lands in the same
 * bucket for an agent's A/B test, and different agents split users independently.
 */
export function abBucket(userId: string, agent: string): number {
  const digest = createHash("sha256").update(`${agent}\u0000${userId}`).digest();
  return digest.readUInt32BE(0) / 2 ** 32;
}

/**
 * Which active version serves a call. Versions are weighted by `abWeight` (all-zero weights share
 * equally); a user is placed by abBucket(), so they see one version for as long as the weights
 * hold. A call without a user (admin, batch) takes the heaviest version, the newest on a tie.
 * Undefined when nothing is active: the caller falls back to the files.
 */
export function pickActiveVersion(
  rows: readonly OverlayPromptVersion[],
  agent: string,
  userId?: string,
): ActiveVersion | undefined {
  const active = rows
    .filter((row) => row.active)
    .map((row) => ({
      version: overlayVersionNumber(row.version),
      weight: Number.isFinite(row.abWeight) ? Math.max(0, row.abWeight) : 0,
      routeOverride: row.routeOverride ?? null,
    }))
    // Sorted so the buckets map onto versions identically whatever order the rows arrive in.
    .sort((a, b) => a.version - b.version);
  if (active.length === 0) return undefined;
  const total = active.reduce((sum, row) => sum + row.weight, 0);
  const weighted = total > 0 ? active : active.map((row) => ({ ...row, weight: 1 }));
  const sum = total > 0 ? total : active.length;

  const pick = (row: (typeof weighted)[number]): ActiveVersion => ({
    version: row.version,
    routeOverride: row.routeOverride,
  });
  if (userId === undefined) {
    const heaviest = weighted.reduce((best, row) =>
      row.weight > best.weight || (row.weight === best.weight && row.version > best.version)
        ? row
        : best,
    );
    return pick(heaviest);
  }
  const target = abBucket(userId, agent) * sum;
  let running = 0;
  // The last version also catches float rounding at the very top of the range.
  let chosen = weighted[weighted.length - 1];
  for (const row of weighted) {
    running += row.weight;
    if (target < running) {
      chosen = row;
      break;
    }
  }
  return chosen && pick(chosen);
}

/**
 * The files' canon with the overlay's published documents laid over it (the highest version of a
 * slug wins), plus a fingerprint that changes only when the content does. Ordered by slug, so the
 * compiled subsets are byte-identical for identical content.
 */
export function overlayCanon(
  files: CanonLibrary,
  published: readonly OverlayCanonDoc[],
): { library: CanonLibrary; fingerprint: string } {
  if (published.length === 0) return { library: files, fingerprint: "files" };
  const latest = new Map<string, OverlayCanonDoc>();
  for (const doc of published) {
    const seen = latest.get(doc.slug);
    if (!seen || doc.version > seen.version) latest.set(doc.slug, doc);
  }
  const bySlug = new Map<string, CanonDoc>(files.docs.map((doc) => [doc.slug, doc]));
  const hash = createHash("sha256");
  for (const doc of [...latest.values()].sort((a, b) => (a.slug < b.slug ? -1 : 1))) {
    bySlug.set(doc.slug, parseCanonDoc(doc.content, `${doc.slug}.md`));
    hash.update(`${doc.slug}\u0000${doc.version}\u0000${doc.content}\u0000`);
  }
  return {
    library: buildCanonLibrary([...bySlug.values()]),
    fingerprint: hash.digest("hex").slice(0, 16),
  };
}
