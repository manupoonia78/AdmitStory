/**
 * The golden-set invented-fact check (spec §8.11, Phase 4 AC) over every recorded kit.draft and
 * kit.shortform reply. Today those are synthetic; after a live re-record
 * (`pnpm --filter @admitstory/ai record:phase4` with AI_MODE=live) this is the live AC run.
 *
 *   pnpm --filter @admitstory/ai kit:golden
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inventedFacts } from "../src/fixtures/golden";
import { loadApplicant } from "../src/fixtures/load";
import { repoRoot } from "../src/paths";

const root = repoRoot();
let checked = 0;
let invented = 0;
for (const task of ["kit.draft", "kit.shortform"]) {
  const dir = join(root, "fixtures/llm-replays", task);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const replay = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      meta: { note: string; synthetic?: boolean };
      response: { body: string };
    };
    const applicant = /fictional ([a-z-]+) applicant/.exec(replay.meta.note)?.[1];
    const school = /fictional ([a-z-]+) pack/.exec(replay.meta.note)?.[1];
    if (!applicant || !school) continue;
    const body = JSON.parse(replay.response.body) as {
      content: { type: string; text?: string; input?: unknown }[];
    };
    const block = body.content.find((b) => b.type === "tool_use" || b.type === "text");
    const output = block?.type === "tool_use" ? block.input : JSON.parse(block?.text ?? "{}");
    const fixture = loadApplicant(applicant);
    const found = inventedFacts(output, {
      truth: fixture.groundTruth,
      profile: fixture.profile,
      pack: readFileSync(
        join(root, "packages/ai/scripts/samples", `${school}.compiled.txt`),
        "utf8",
      ),
    });
    checked += 1;
    invented += found.length;
    const tag = replay.meta.synthetic ? "synthetic" : "live";
    console.log(
      `${task} ${file.slice(0, 8)} (${applicant}, ${school}, ${tag}): ${found.length} invented`,
    );
    for (const f of found) console.log(`  ${f.kind}: "${f.text}" in "${f.sentence}"`);
  }
}
console.log(`\n${checked} outputs checked, ${invented} invented facts.`);
process.exit(invented === 0 ? 0 : 1);
