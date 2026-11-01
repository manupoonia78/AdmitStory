// Loads the six fictional fixture packs (fixtures/schools) and the Darden draft
// (knowledge/schools) for the tests. Raw JSON: each test parses what it needs.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSchoolPack } from "../src/schema/school-pack";
import type { SchoolPack } from "../src/types";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export const FIXTURE_DIR = join(ROOT, "fixtures/schools");
export const DARDEN_DRAFT = join(ROOT, "knowledge/schools/darden/2026-27/pack.draft.json");

export const FIXTURE_SLUGS = readdirSync(FIXTURE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

export function rawFixture(slug: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, slug, "pack.json"), "utf8"));
}

export function fixture(slug: string): SchoolPack {
  return parseSchoolPack(rawFixture(slug));
}

export function rawDarden(): unknown {
  return JSON.parse(readFileSync(DARDEN_DRAFT, "utf8"));
}

/** Today, for compiling: fixed so the tests don't depend on the clock. */
export const NOW = "2026-10-31";
export const CYCLE = "2026-27";
