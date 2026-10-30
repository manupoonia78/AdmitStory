// Prompt archetypes (spec Appendix A8, canon file prompt-archetypes.md): what each kind of
// application prompt is really asking. Phase 1 uses them for one job only — which evidence slots
// a typical application consumes (Appendix C's `arch` column), which is what makes the slot
// selector's need() term work before any School Pack exists. Phases 3+ use them to pick the canon
// section for a deliverable.

export const ARCHETYPE_IDS = [
  "GOALS",
  "WHY-SCHOOL",
  "LEADERSHIP",
  "SETBACK",
  "IDENTITY",
  "SUPPORT",
  "CONTRIBUTION",
  "VALUES",
  "OPTIONAL",
  "CONTEXT",
  "REAPPLICANT",
  "LIST",
  "MICRO",
  "GOALBOX",
  "VIDEO",
  "SCHOLARSHIP",
] as const;

export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

export interface Archetype {
  id: ArchetypeId;
  /** Plain label for the Workspace header and the file map. */
  label: string;
  /** Canon rule prefix in prompt-archetypes.md: ARCH-GOALS, ARCH-WHY-SCHOOL… */
  canonRule: string;
  /**
   * How often a school's application asks for this archetype, as a share of applications in a
   * default top-20 mix. Used by the slot selector's need() term until a School Pack supplies the
   * real deliverable list (spec §5.2; Phase 3 replaces it). Judgment from Appendix A8 and A7,
   * not a measured statistic — it only has to rank slots sensibly.
   */
  prevalence: number;
}

export const ARCHETYPES: readonly Archetype[] = [
  // Asked by effectively every school.
  { id: "GOALS", label: "Career goals and why an MBA", canonRule: "ARCH-GOALS", prevalence: 1 },
  { id: "WHY-SCHOOL", label: "Why us", canonRule: "ARCH-WHY-SCHOOL", prevalence: 0.9 },
  { id: "GOALBOX", label: "Short goal fields", canonRule: "ARCH-GOALBOX", prevalence: 0.8 },
  { id: "IDENTITY", label: "Who you are", canonRule: "ARCH-IDENTITY", prevalence: 0.75 },
  {
    id: "LEADERSHIP",
    label: "Leading and influencing",
    canonRule: "ARCH-LEADERSHIP",
    prevalence: 0.7,
  },
  { id: "VIDEO", label: "Video answers", canonRule: "ARCH-VIDEO", prevalence: 0.45 },
  {
    id: "CONTRIBUTION",
    label: "What you'll add",
    canonRule: "ARCH-CONTRIBUTION",
    prevalence: 0.45,
  },
  { id: "SETBACK", label: "A failure or setback", canonRule: "ARCH-SETBACK", prevalence: 0.4 },
  { id: "OPTIONAL", label: "Additional information", canonRule: "ARCH-OPTIONAL", prevalence: 0.4 },
  { id: "MICRO", label: "Short fun prompts", canonRule: "ARCH-MICRO", prevalence: 0.35 },
  { id: "SUPPORT", label: "Supporting someone", canonRule: "ARCH-SUPPORT", prevalence: 0.3 },
  { id: "LIST", label: "N things about you", canonRule: "ARCH-LIST", prevalence: 0.25 },
  {
    id: "SCHOLARSHIP",
    label: "Scholarship essay",
    canonRule: "ARCH-SCHOLARSHIP",
    prevalence: 0.25,
  },
  { id: "VALUES", label: "An ethical dilemma", canonRule: "ARCH-VALUES", prevalence: 0.2 },
  { id: "CONTEXT", label: "Circumstances", canonRule: "ARCH-CONTEXT", prevalence: 0.15 },
  // Reapplicants only; the selector gates this one on the applicant, not on prevalence.
  { id: "REAPPLICANT", label: "What has changed", canonRule: "ARCH-REAPPLICANT", prevalence: 1 },
] as const;

const BY_ID = new Map(ARCHETYPES.map((entry) => [entry.id, entry] as const));

export function archetype(id: ArchetypeId): Archetype {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown archetype: ${id}`);
  return found;
}

export function isArchetypeId(value: string): value is ArchetypeId {
  return BY_ID.has(value as ArchetypeId);
}

/** Archetypes only reapplicants are asked for, so the selector can drop their slots. */
export const REAPPLICANT_ONLY_ARCHETYPES: readonly ArchetypeId[] = ["REAPPLICANT"];
