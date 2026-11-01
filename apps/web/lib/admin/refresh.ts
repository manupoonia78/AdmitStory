import "server-only";

import type { KbRefreshCheckInput, KbRefreshCheckOutput } from "@admitstory/ai";
import {
  addKbSource,
  createProposals,
  getDraftPack,
  getKbSource,
  getPackForAdmin,
  hashContent,
  listKbSources,
  listPackVersions,
  listSchoolsForAdmin,
  recordRefreshSnapshot,
  type AdminContext,
} from "@admitstory/db";
import { OFFICIAL_URL_KINDS, type OfficialUrlKind } from "@admitstory/kb/types";
import { extractText, fetchUrl, type FetchUrlOptions } from "@admitstory/kb/ingest";
import { allowedHosts, officialUrlsOf } from "./pack";

// kb/refresh-check (spec §9.3 "Refresh checker"): for each school's official URLs, fetch and
// compare to the last snapshot's hash; when a page changed, a Haiku pass (kb.refresh_check) says
// what changed and an admin review item is created. Weekly August–January, monthly otherwise.
//
// Snapshots keep only a hash (kb_refresh_snapshots), so each new version of a page is also kept as
// an `official` source (not yet ingested): it is the "old text" the next comparison reads, and the
// admin can ingest it from the console to get field-level proposals.

/** Weekly from August to January (application season), otherwise the first week of the month. */
export function isRefreshDay(date: Date): boolean {
  const month = date.getUTCMonth(); // 0 = January
  const inSeason = month >= 7 || month === 0;
  return inSeason || date.getUTCDate() <= 7;
}

export interface RefreshTarget {
  cycleId: string;
  schoolId: string;
  school: string;
  cycle: string;
  url: string;
  kind: OfficialUrlKind;
  allowHosts: string[];
}

/** Every official URL of every non-archived cycle, from its draft or newest published pack. */
export async function refreshTargets(admin: AdminContext): Promise<RefreshTarget[]> {
  const targets: RefreshTarget[] = [];
  for (const school of await listSchoolsForAdmin(admin)) {
    for (const cycle of school.cycles) {
      if (cycle.status === "archived") continue;
      let data: unknown = (await getDraftPack(admin, cycle.id))?.data;
      if (data === undefined) {
        const published = (await listPackVersions(admin, cycle.id)).find(
          (v) => v.status === "published",
        );
        data = published ? (await getPackForAdmin(admin, published.id))?.data : undefined;
      }
      const urls = officialUrlsOf(data);
      const hosts = allowedHosts(school.website, urls);
      for (const entry of urls) {
        const kind = (OFFICIAL_URL_KINDS as readonly string[]).includes(entry.kind)
          ? (entry.kind as OfficialUrlKind)
          : "other";
        targets.push({
          cycleId: cycle.id,
          schoolId: school.id,
          school: school.name,
          cycle: cycle.cycle,
          url: entry.url,
          kind,
          allowHosts: hosts,
        });
      }
    }
  }
  return targets;
}

export interface PageChange {
  target: RefreshTarget;
  newSourceId: string;
  input: KbRefreshCheckInput;
}

const MAX_TEXT = 100_000;

/**
 * Fetches one page, records its snapshot, and keeps a new version as a source. Returns the change
 * to summarise, or null when nothing changed (or this was the first fetch, a baseline).
 */
export async function checkPage(
  admin: AdminContext,
  target: RefreshTarget,
  now: Date,
  fetchOptions: Pick<FetchUrlOptions, "resolve" | "transport"> = {},
): Promise<PageChange | null> {
  const fetched = await fetchUrl(target.url, { allowHosts: target.allowHosts, ...fetchOptions });
  const type = (fetched.contentType ?? "").split(";")[0]?.trim().toLowerCase();
  const extracted = await extractText({
    bytes: fetched.bytes,
    format: type === "application/pdf" ? "pdf" : type === "text/plain" ? "txt" : "html",
  });
  const text = extracted.text;
  const hash = hashContent(text);
  const { changed, previousHash } = await recordRefreshSnapshot(admin, {
    schoolCycleId: target.cycleId,
    url: target.url,
    contentHash: hash,
    fetchedAt: now,
  });
  if (previousHash === hash) return null;

  const day = now.toISOString().slice(0, 10);
  const kept = await addKbSource(admin, {
    schoolId: target.schoolId,
    cycle: target.cycle,
    type: "official",
    title: `${target.school}: ${target.kind.replace("_", " ")} page, fetched ${day}`.slice(0, 300),
    url: target.url,
    text,
    verifiedAt: now,
    rightsNote: "School-published page (§9.6): usable with attribution.",
    meta: { refresh: true, kind: target.kind },
  });
  if (!changed || previousHash === null) return null;

  const [previous] = await listKbSources(admin, { contentHash: previousHash, limit: 1 });
  const oldText = previous ? ((await getKbSource(admin, previous.id))?.text ?? "") : "";
  const domains = target.allowHosts.slice(0, 5);
  return {
    target,
    newSourceId: kept.id,
    input: {
      school: target.school.slice(0, 120),
      url: target.url,
      url_kind: target.kind,
      old_text: oldText.slice(0, MAX_TEXT),
      new_text: text.slice(0, MAX_TEXT),
      allowed_domains: domains.length > 0 ? domains : [new URL(target.url).hostname],
    },
  };
}

/** One admin review item per affected field (§9.3 "creates an admin review task"). */
export async function recordRefreshResult(
  admin: AdminContext,
  change: PageChange,
  output: KbRefreshCheckOutput,
): Promise<number> {
  if (!output.changed) return 0;
  const fields = output.affected_fields.length > 0 ? output.affected_fields : ["official_urls"];
  const rows = await createProposals(
    admin,
    fields.map((field) => ({
      sourceId: null,
      cycleId: change.target.cycleId,
      fieldPath: field,
      proposed: {
        refresh_check: output.summary,
        url: change.target.url,
        kind: change.target.kind,
        newSourceId: change.newSourceId,
      },
      current: null,
      confidence: 0.5,
    })),
  );
  return rows.length;
}
