// Checks every fixture's trait and slot references resolve, that each covers the slots a Studio
// run needs, and that no number appears in a story's prose without being declared in its numbers[]
// (spec §8.11: anything outside the ground truth counts as an invention).
//
//   pnpm --filter @admitstory/ai check:fixtures

import { TRAIT_IDS } from "@admitstory/shared";
import { SLOT_KEYS } from "@admitstory/slots";
import { loadApplicants } from "../src/fixtures";

const traits = new Set<string>(TRAIT_IDS);
const slots = new Set<string>(SLOT_KEYS);
let bad = 0;
for (const fixture of loadApplicants()) {
  const covered = new Set<string>();
  for (const story of fixture.groundTruth.stories) {
    for (const trait of story.traits)
      if (!traits.has(trait)) {
        console.error(`${fixture.profile.slug}/${story.ref}: unknown trait "${trait}"`);
        bad++;
      }
    for (const slot of story.slots) {
      if (!slots.has(slot)) {
        console.error(`${fixture.profile.slug}/${story.ref}: unknown slot "${slot}"`);
        bad++;
      }
      covered.add(slot);
    }
    // Every number in the prose must be in the numbers array (§8.11's invented-fact check).
    const prose = [
      story.situation,
      story.stakes,
      ...story.actions,
      story.result,
      story.reflection,
    ].join(" ");
    const declared = story.numbers.map((n) => n.value).join(" ");
    for (const match of prose.match(/\b\d[\d,.]*\b/g) ?? [])
      if (!declared.includes(match) && !/^(19|20)\d{2}$/.test(match))
        console.warn(
          `  ${fixture.profile.slug}/${story.ref}: "${match}" in prose but not in numbers[]`,
        );
  }
  const want = [
    "impact.biggest",
    "numbers.impact",
    "failure.consequential",
    "self.feedback",
    "goals.origin",
  ];
  const missing = want.filter((slot) => !covered.has(slot));
  const sensitive = fixture.groundTruth.stories.filter((s) => s.sensitivity === "sensitive").length;
  console.log(
    `${fixture.profile.slug.padEnd(32)} ${String(fixture.groundTruth.stories.length).padStart(2)} stories, ` +
      `${String(covered.size).padStart(2)} slots, ${sensitive} sensitive` +
      (missing.length ? `  MISSING: ${missing.join(", ")}` : ""),
  );
}
console.log(
  bad === 0 ? "\nEvery trait and slot reference resolves." : `\n${bad} bad reference(s).`,
);
process.exit(bad === 0 ? 0 : 1);
