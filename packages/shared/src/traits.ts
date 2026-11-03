// The trait taxonomy (spec Appendix D), Admitstory's own. Used for brand, the file map, the critic
// and analytics. Every trait names the lenses it evidences, so a story's lenses can be derived
// from its traits rather than guessed twice.

import { LENS_IDS, type LensId } from "./lenses";

export const TRAIT_GROUPS = ["leadership", "character", "effectiveness", "perspective"] as const;

export type TraitGroup = (typeof TRAIT_GROUPS)[number];

export const TRAIT_GROUP_LABELS: Record<TraitGroup, string> = {
  leadership: "Leadership",
  character: "Character",
  effectiveness: "Effectiveness",
  perspective: "Perspective",
};

export interface Trait {
  id: string;
  group: TraitGroup;
  /** Plain label, shown to the applicant. Never the id. */
  label: string;
  /** The lenses this trait evidences. Empty for `unusual_path`, which speaks to fit, not a lens. */
  lenses: readonly LensId[];
  /** Appendix D marks `unusual_path` as "(fit)" rather than a lens. */
  fitOnly?: true;
}

export const TRAITS: readonly Trait[] = [
  // Leadership
  {
    id: "originates_ideas",
    group: "leadership",
    label: "Starts new approaches",
    lenses: ["leadership"],
  },
  { id: "acts_unasked", group: "leadership", label: "Takes initiative", lenses: ["leadership"] },
  {
    id: "brings_people_along",
    group: "leadership",
    label: "Persuades and aligns others",
    lenses: ["leadership", "employability"],
  },
  {
    id: "develops_people",
    group: "leadership",
    label: "Invests in others' growth",
    lenses: ["leadership", "self_awareness"],
  },
  {
    id: "principled_stands",
    group: "leadership",
    label: "Holds a line at a cost",
    lenses: ["leadership", "self_awareness"],
  },
  {
    id: "steady_in_ambiguity",
    group: "leadership",
    label: "Builds structure where there is none",
    lenses: ["leadership", "employability"],
  },
  // Character
  { id: "self_aware", group: "character", label: "Knows their gaps", lenses: ["self_awareness"] },
  {
    id: "acts_on_feedback",
    group: "character",
    label: "Coachable, changes behaviour",
    lenses: ["self_awareness"],
  },
  {
    id: "resilient",
    group: "character",
    label: "Comes back from setbacks",
    lenses: ["self_awareness"],
  },
  {
    id: "empathetic",
    group: "character",
    label: "Reads and responds to people",
    lenses: ["self_awareness", "leadership"],
  },
  {
    id: "honest_about_limits",
    group: "character",
    label: "Candid, not falsely modest",
    lenses: ["self_awareness"],
  },
  // Effectiveness
  {
    id: "measurable_impact",
    group: "effectiveness",
    label: "Moves numbers that matter",
    lenses: ["employability"],
  },
  {
    id: "analytical",
    group: "effectiveness",
    label: "Thinks in data and structure",
    lenses: ["academics", "employability"],
  },
  {
    id: "commercial_judgment",
    group: "effectiveness",
    label: "Understands value, cost, customers",
    lenses: ["employability"],
  },
  {
    id: "cross_functional_influence",
    group: "effectiveness",
    label: "Works across teams and functions",
    lenses: ["employability", "leadership"],
  },
  {
    id: "delivers_under_pressure",
    group: "effectiveness",
    label: "Ships when it counts",
    lenses: ["employability"],
  },
  // Perspective
  {
    id: "global_outlook",
    group: "perspective",
    label: "Comfortable across cultures",
    lenses: ["employability", "self_awareness"],
  },
  {
    id: "unusual_path",
    group: "perspective",
    label: "Brings a perspective the class lacks",
    lenses: [],
    fitOnly: true,
  },
  {
    id: "community_builder",
    group: "perspective",
    label: "Creates belonging for others",
    lenses: ["leadership", "self_awareness"],
  },
  {
    id: "curious_learner",
    group: "perspective",
    label: "Seeks out learning from others",
    lenses: ["academics", "self_awareness"],
  },
  { id: "creative", group: "perspective", label: "Makes original things", lenses: ["leadership"] },
] as const;

export type TraitId = (typeof TRAITS)[number]["id"];

export const TRAIT_IDS = TRAITS.map((entry) => entry.id) as readonly TraitId[];

const BY_ID = new Map(TRAITS.map((trait) => [trait.id, trait] as const));

export function trait(id: TraitId): Trait {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown trait: ${id}`);
  return found;
}

export function isTraitId(value: string): value is TraitId {
  return BY_ID.has(value);
}

export function traitLabel(id: TraitId): string {
  return trait(id).label;
}

/** The lenses a set of traits evidences, in canonical order and without duplicates. */
export function lensesForTraits(ids: readonly TraitId[]): LensId[] {
  const lenses = new Set<LensId>();
  for (const id of ids) for (const lens of trait(id).lenses) lenses.add(lens);
  return LENS_IDS.filter((lens) => lenses.has(lens));
}

export function traitsInGroup(group: TraitGroup): Trait[] {
  return TRAITS.filter((candidate) => candidate.group === group);
}
