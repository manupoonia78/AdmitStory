// Loading the synthetic applicants (spec §8.11). Reads from `fixtures/applicants/` at the repo
// root, found the same way the canon and prompt folders are (paths.ts), so it works from any
// working directory and inside a bundled app.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "../paths";
import { FixtureExpected, FixtureProfile, GroundTruth, type Fixture } from "./types";

export function applicantsDir(root?: string): string {
  const base = root ?? findRepoRoot(process.cwd());
  if (base === null)
    throw new Error(
      "Could not find the repository root, so fixtures/applicants cannot be located. Pass a path.",
    );
  return join(base, "fixtures", "applicants");
}

export function listApplicantSlugs(dir = applicantsDir()): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function readJson(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not readable JSON: ${(error as Error).message}`);
  }
}

export function loadApplicant(slug: string, dir = applicantsDir()): Fixture {
  const base = join(dir, slug);
  const profile = FixtureProfile.safeParse(
    readJson(join(base, "profile.json"), `${slug}/profile.json`),
  );
  if (!profile.success)
    throw new Error(
      `${slug}/profile.json is invalid: ${profile.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  if (profile.data.slug !== slug)
    throw new Error(`${slug}/profile.json has slug "${profile.data.slug}"`);

  const truth = GroundTruth.safeParse(
    readJson(join(base, "ground_truth.json"), `${slug}/ground_truth.json`),
  );
  if (!truth.success)
    throw new Error(
      `${slug}/ground_truth.json is invalid: ${truth.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );

  const seedPath = join(base, "transcript_seed.md");
  if (!existsSync(seedPath)) throw new Error(`${slug}/transcript_seed.md is missing`);

  return {
    profile: profile.data,
    groundTruth: truth.data,
    transcriptSeed: readFileSync(seedPath, "utf8"),
  };
}

export function loadApplicants(dir = applicantsDir()): Fixture[] {
  return listApplicantSlugs(dir).map((slug) => loadApplicant(slug, dir));
}

/**
 * `expected.json` for one applicant, checked against its ground truth: every story it names must
 * be one of the fixture's stories, and a story it says needs consent must be marked sensitive.
 */
export function loadExpected(slug: string, dir = applicantsDir()): FixtureExpected {
  const parsed = FixtureExpected.safeParse(
    readJson(join(dir, slug, "expected.json"), `${slug}/expected.json`),
  );
  if (!parsed.success)
    throw new Error(
      `${slug}/expected.json is invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  const expected = parsed.data;
  if (expected.slug !== slug) throw new Error(`${slug}/expected.json has slug "${expected.slug}"`);
  const { groundTruth } = loadApplicant(slug, dir);
  const stories = new Map(groundTruth.stories.map((story) => [story.ref, story] as const));
  for (const [archetype, ref] of Object.entries(expected.lead_story)) {
    const story = stories.get(ref);
    if (!story) throw new Error(`${slug}/expected.json: ${archetype} names unknown story "${ref}"`);
    if (story.sensitivity === "sensitive")
      throw new Error(`${slug}/expected.json: ${archetype} leads with sensitive story "${ref}"`);
  }
  for (const ref of expected.never_without_consent)
    if (stories.get(ref)?.sensitivity !== "sensitive")
      throw new Error(`${slug}/expected.json: "${ref}" is not a sensitive story`);
  return expected;
}
