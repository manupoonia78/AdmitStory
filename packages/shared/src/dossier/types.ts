// The input to the compact dossier compiler (spec §8.2 L2). Plain data, deliberately not Drizzle
// rows: the compiler is a pure function so it can be unit-tested against fixtures and reused by
// the eval harness.

import type { ChapterId } from "../chapters";
import type { LensId } from "../lenses";
import type { TraitId } from "../traits";

export const FACT_STATUSES = ["confirmed", "needs_confirmation", "conflict"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const STORY_STATUSES = ["confirmed", "partial", "unconfirmed"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

/** Spec §5.3b / §14.3. `sensitive` means health, bereavement, identity, hardship, legal, finances. */
export const SENSITIVITIES = ["none", "personal", "sensitive"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export const STORY_CONTEXTS = ["professional", "academic", "community", "personal"] as const;
export type StoryContext = (typeof STORY_CONTEXTS)[number];

export interface DossierApplicant {
  /** Short stable handle, never a user id or a name: "A-7f3". */
  handle: string;
  programType: string;
  targetIntake?: number | null;
  /** ISO 3166-1 alpha-2, as the applicant gave it. */
  country?: string | null;
  yearsExperience?: number | null;
  test?: { type: string; score: number } | null;
  gpa?: { value: number; scale: number } | null;
}

export interface DossierFact {
  code: string;
  key: string;
  value: string;
  /** Parenthetical context the Extractor kept: "US health system; 40+ hospitals". */
  note?: string | null;
  status: FactStatus;
  /** What drafts must say instead of `value`, when the applicant set one. */
  approvedPhrasing?: string | null;
  sensitivity: Sensitivity;
  /** False withholds the fact from the snapshot entirely (§8.7, §14.3). */
  consentToUse: boolean;
  /** Set when status is `conflict`: the other value and where each came from. */
  conflict?: { otherValue: string; note?: string } | null;
}

export interface DossierGoldenLine {
  code: string;
  text: string;
  /** An English rendering when the applicant spoke another language (§7.5). */
  english?: string | null;
}

export interface DossierPerson {
  code: string;
  name: string;
  roleInLife: string;
  mayName: boolean;
}

export interface DossierStory {
  code: string;
  nickname: string;
  /** "2024", "2019–2021", "before college". */
  era: string;
  context: StoryContext;
  chapter?: ChapterId | null;
  lenses: readonly LensId[];
  traits: readonly TraitId[];
  status: StoryStatus;
  situation: string;
  stakes?: string | null;
  actions: readonly string[];
  result?: string | null;
  reflection?: string | null;
  lines: readonly DossierGoldenLine[];
  people: readonly DossierPerson[];
  /** Deliverables this story already serves: "Darden E1 (primary)". Empty until Phase 4. */
  usedIn: readonly string[];
  sensitivity: Sensitivity;
  consentToUse: boolean;
}

export interface DossierBrandTrait {
  trait: TraitId;
  /** Story codes that prove it. */
  stories: readonly string[];
}

export interface DossierVoice {
  /** The ≤300-token voice card, already written by the Consolidator (§5.3d). */
  card: string;
}

export interface DossierGoals {
  shortTerm?: string | null;
  longTerm?: string | null;
  planB?: string | null;
}

/** A conversation with a student, alum or employee at the school being written for (§5.14). */
export interface DossierEngagement {
  code: string;
  name: string;
  /** "2nd-year; product club". */
  role: string;
  /** What the applicant learned, in their words. */
  taught: string;
  mayName: boolean;
}

export interface DossierInput {
  applicant: DossierApplicant;
  facts: readonly DossierFact[];
  stories: readonly DossierStory[];
  brand: readonly DossierBrandTrait[];
  voice?: DossierVoice | null;
  goals?: DossierGoals | null;
  /** Only the school currently being written for, per §8.2's ENGAGEMENT(this school) line. */
  engagement?: readonly DossierEngagement[];
}
