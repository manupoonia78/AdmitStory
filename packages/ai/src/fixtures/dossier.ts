// A compact-dossier input built straight from a fixture's ground truth, for golden-set runs that
// skip the Studio (scripts/kit-golden.ts). Codes are assigned in ground-truth order; sensitive
// stories are kept but without consent, so compileDossier withholds them as the product does
// (§8.7, §14.3). The map back from codes to story refs lets a run compare its file map with
// expected.json.

import { LENS_IDS, TRAIT_IDS, code, type LensId, type TraitId } from "@admitstory/shared";
import type { DossierInput } from "@admitstory/shared";
import type { Fixture } from "./types";

export interface FixtureDossier {
  input: DossierInput;
  /** Story code → ground-truth ref ("S02" → "scheduling_rewrite_refused"). */
  storyRefs: Map<string, string>;
}

const LENS_BY_SLOT: Record<string, LensId> = {
  academics: "academics",
  impact: "employability",
  employ: "employability",
  work: "employability",
  goals: "employability",
  numbers: "employability",
  leadership: "leadership",
  community: "leadership",
  support: "self_awareness",
  self: "self_awareness",
  failure: "self_awareness",
  identity: "self_awareness",
  values: "self_awareness",
};

const isTrait = (value: string): value is TraitId =>
  (TRAIT_IDS as readonly string[]).includes(value);

export function fixtureDossierInput(fixture: Fixture): FixtureDossier {
  const { profile, groundTruth: truth } = fixture;
  const storyRefs = new Map<string, string>();
  let person = 0;

  const stories = truth.stories.map((story, index) => {
    const storyCode = code("story", index + 1);
    storyRefs.set(storyCode, story.ref);
    const lenses = [
      ...new Set(story.slots.map((slot) => LENS_BY_SLOT[slot.split(".")[0] ?? ""]).filter(Boolean)),
    ] as LensId[];
    return {
      code: storyCode,
      nickname: story.nickname,
      era: story.era,
      context: story.context,
      lenses: LENS_IDS.filter((lens) => lenses.includes(lens)),
      traits: story.traits.filter(isTrait),
      status: "confirmed" as const,
      situation: story.situation,
      stakes: story.stakes,
      actions: story.actions,
      result: story.result,
      reflection: story.reflection,
      lines: [],
      people: story.people.map((p) => ({
        code: code("person", (person += 1)),
        name: p.name,
        roleInLife: p.role,
        mayName: p.mayName,
      })),
      usedIn: [],
      sensitivity: story.sensitivity,
      consentToUse: story.sensitivity !== "sensitive",
    };
  });

  // Brand: the three traits the most consented stories show.
  const counts = new Map<TraitId, string[]>();
  for (const story of stories)
    if (story.consentToUse)
      for (const trait of story.traits)
        counts.set(trait, [...(counts.get(trait) ?? []), story.code]);
  const brand = [...counts.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([trait, codes]) => ({ trait, stories: codes.slice(0, 3) }));

  return {
    storyRefs,
    input: {
      applicant: {
        handle: `A-${profile.slug.slice(0, 3)}`,
        programType: "MBA",
        targetIntake: profile.targetIntake,
        country: profile.country,
        yearsExperience: profile.yearsExperience,
        test: profile.test,
        gpa: profile.gpa,
      },
      facts: truth.facts.map((fact, index) => ({
        code: code("fact", index + 1),
        key: fact.key,
        value: fact.value,
        note: fact.note ?? null,
        status: "confirmed" as const,
        sensitivity: "none" as const,
        consentToUse: true,
      })),
      stories,
      brand,
      voice: null,
      goals: {
        shortTerm: truth.goals.shortTerm,
        longTerm: truth.goals.longTerm,
        planB: truth.goals.planB,
      },
    },
  };
}
