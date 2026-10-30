import type { BrandTrait, VoiceStats } from "@admitstory/db";
import type { VoiceprintIdentity } from "@admitstory/shared";

// What the Dossier page hands its client components (spec §5.3).

export interface DossierLine {
  id: string;
  code: string;
  text: string;
  starred: boolean;
}

export interface DossierStoryView {
  id: string;
  code: string;
  nickname: string;
  era: string;
  context: "professional" | "academic" | "community" | "personal";
  chapter: string | null;
  situation: string | null;
  stakes: string | null;
  actions: string[];
  result: string | null;
  reflection: string | null;
  numbers: { label: string; value: string }[];
  traits: string[];
  lenses: string[];
  status: "confirmed" | "partial" | "unconfirmed";
  missing: { question: string; approxWords?: number }[];
  sensitivity: "none" | "personal" | "sensitive";
  consentToUse: boolean;
  peopleCodes: string[];
  lines: DossierLine[];
}

export interface DossierFactView {
  id: string;
  code: string;
  key: string;
  value: string;
  note: string | null;
  approvedPhrasing: string | null;
  status: "confirmed" | "needs_confirmation" | "conflict";
  sensitivity: "none" | "personal" | "sensitive";
  consentToUse: boolean;
  /** The other value of a conflict, which the applicant chooses between (spec §5.3a). */
  otherValue: string | null;
}

export interface DossierPersonView {
  id: string;
  code: string;
  name: string;
  roleInLife: string;
  mayName: boolean;
}

export interface DossierBrandView {
  traits: BrandTrait[];
  positioningLine: string | null;
  accepted: boolean;
}

export interface DossierVoiceView {
  card: string | null;
  stats: VoiceStats | null;
  tone: string | null;
  identity: VoiceprintIdentity | null;
}

export interface DossierGoalsView {
  shortTerm: string | null;
  longTerm: string | null;
  planB: string | null;
}

/** Spec §5.3a: the three fact statuses, in words the applicant reads. */
export const FACT_STATUS_LABELS = {
  confirmed: "Confirmed",
  needs_confirmation: "Needs confirming",
  conflict: "Two versions",
} as const;

export const STORY_STATUS_LABELS = {
  confirmed: "Confirmed",
  partial: "Needs a detail",
  unconfirmed: "Just mentioned",
} as const;
