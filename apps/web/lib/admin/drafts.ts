import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@admitstory/ai";
import {
  getDraftPack,
  getPackForAdmin,
  getSchoolForAdmin,
  insertDraftPack,
  listPackVersions,
  listSchoolsForAdmin,
  updateDraftPack,
  type AdminContext,
  type AdminCycleSummary,
  type School,
  type SchoolPack as PackRow,
  type SchoolPackData,
} from "@admitstory/db";
import { parseSchoolPack } from "@admitstory/kb/schema";
import { AdminActionError } from "./errors";
import { skeletonPack } from "./pack";

// The working draft of a cycle's School Pack (spec §9.3). There is at most one per cycle: it starts
// from the newest published version, or from a skeleton, or from a draft file in knowledge/.

export interface CycleRef {
  school: School;
  cycle: AdminCycleSummary;
}

/** A cycle with its school, for admin screens and jobs. */
export async function findCycle(admin: AdminContext, cycleId: string): Promise<CycleRef | null> {
  const schools = await listSchoolsForAdmin(admin);
  for (const school of schools) {
    const cycle = school.cycles.find((c) => c.id === cycleId);
    if (cycle) {
      const { cycles: _cycles, ...rest } = school;
      return { school: rest, cycle };
    }
  }
  return null;
}

/** The cycle row for a school's cycle name ("2026-27"), if it exists. */
export async function findCycleByName(
  admin: AdminContext,
  schoolId: string,
  cycleName: string,
): Promise<CycleRef | null> {
  const schools = await listSchoolsForAdmin(admin);
  const school = schools.find((s) => s.id === schoolId);
  const cycle = school?.cycles.find((c) => c.cycle === cycleName);
  if (!school || !cycle) return null;
  const { cycles: _cycles, ...rest } = school;
  return { school: rest, cycle };
}

/** Keeps the data's `version` equal to the row's, so the compiled header names the right one. */
async function alignVersion(admin: AdminContext, row: PackRow): Promise<PackRow> {
  if ((row.data as { version?: unknown }).version === row.version) return row;
  return updateDraftPack(admin, row.id, { ...row.data, version: row.version });
}

/**
 * The cycle's draft, created when there is none: a copy of the newest published version, or a
 * skeleton built from the school's identity.
 */
export async function ensureDraft(admin: AdminContext, ref: CycleRef): Promise<PackRow> {
  const existing = await getDraftPack(admin, ref.cycle.id);
  if (existing) return existing;
  const versions = await listPackVersions(admin, ref.cycle.id);
  const published = versions.find((v) => v.status === "published");
  const base = published ? (await getPackForAdmin(admin, published.id))?.data : undefined;
  const data = base ?? (skeletonPack(ref.school, ref.cycle.cycle) as unknown as SchoolPackData);
  return alignVersion(admin, await insertDraftPack(admin, ref.cycle.id, data));
}

/* Draft files in knowledge/schools/<slug>/<cycle>/pack.draft.json --------------------------- */

function schoolsDir(): string | null {
  const root = findRepoRoot();
  return root ? join(root, "knowledge", "schools") : null;
}

/** The draft file for a school's cycle, matched by directory name or the pack's own names. */
export function draftFileFor(school: School, cycle: string): string | null {
  const dir = schoolsDir();
  if (!dir || !existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, cycle, "pack.draft.json");
    if (!existsSync(file)) continue;
    if (
      name === school.slug ||
      school.slug.endsWith(`-${name}`) ||
      school.slug.startsWith(`${name}-`)
    )
      return file;
    try {
      const data = JSON.parse(readFileSync(file, "utf8")) as { school?: { short_name?: string } };
      if (data.school?.short_name === school.shortName) return file;
    } catch {
      // An unreadable file is reported when it is imported, not while listing.
    }
  }
  return null;
}

/**
 * Loads the knowledge/ draft for the cycle's school as the working draft, replacing the current
 * draft's data. Validated against the pack schema first; its items stay unverified.
 */
export async function importDraftFile(admin: AdminContext, ref: CycleRef): Promise<PackRow> {
  const file = draftFileFor(ref.school, ref.cycle.cycle);
  if (!file)
    throw new AdminActionError(
      `There's no draft file for ${ref.school.shortName} ${ref.cycle.cycle} in knowledge/schools.`,
      404,
    );
  let pack;
  try {
    pack = parseSchoolPack(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    throw new AdminActionError(
      `The draft file doesn't match the pack schema: ${error instanceof Error ? error.message.slice(0, 400) : "unreadable"}`,
      422,
    );
  }
  if (pack.cycle !== ref.cycle.cycle)
    throw new AdminActionError(`The draft file is for ${pack.cycle}, not ${ref.cycle.cycle}.`, 422);
  return alignVersion(
    admin,
    await insertDraftPack(admin, ref.cycle.id, pack as unknown as SchoolPackData),
  );
}

export async function schoolOrThrow(admin: AdminContext, schoolId: string): Promise<School> {
  const school = await getSchoolForAdmin(admin, schoolId);
  if (!school) throw new AdminActionError("That school could not be found.", 404);
  return school;
}
