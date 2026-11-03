// The Form Advisor and Résumé Pass output shapes (spec §5.10, §8.5.12, canon A9 and A10) as plain
// types and constants. Zod-free, so client components may import them; the validators are in
// `@admitstory/ai` (schemas/forms.ts), checked against these types.

/** §5.10: what to do with one candidate item from the dossier, in this order on screen. */
export const FORM_RECOMMENDATIONS = [
  "lead_with",
  "include",
  "combine_with",
  "move_to_resume",
  "move_to_essay",
  "leave_out",
] as const;
export type FormRecommendation = (typeof FORM_RECOMMENDATIONS)[number];

/** Sentence-case labels for the recommendation lanes (§6.9). */
export const FORM_RECOMMENDATION_LABELS: Record<FormRecommendation, string> = {
  lead_with: "Lead with",
  include: "Include",
  combine_with: "Combine with…",
  move_to_resume: "Move to resume",
  move_to_essay: "Move to an essay",
  leave_out: "Leave out",
};

/** Recommendations that put an entry in the form (and so count against `item_count_max`). */
export const FORM_ENTRY_RECOMMENDATIONS: readonly FormRecommendation[] = [
  "lead_with",
  "include",
  "combine_with",
];

/** At most this many "Make it stronger" pointers per item. */
export const FORM_STRONGER_MAX = 3;

export interface FormNeed {
  question: string;
  approx_words: number;
}

export interface FormEntry {
  /** The rewritten entry: plain, outcome-first, within the field's limit by the school's rule. */
  text: string;
  /** F/S/L codes the entry draws on. */
  sources: string[];
}

export interface FormItem {
  /** Stable within its section: "i1", "i2"… */
  id: string;
  /** A short label for the candidate ("Saturday coding class"). */
  candidate: string;
  /** The dossier facts and stories this candidate is (F/S codes). */
  cites: string[];
  recommendation: FormRecommendation;
  /** For combine_with: the item id in the same section it merges with. */
  combine_with: string | null;
  /** For move_to_essay: the deliverable key it belongs in. */
  move_to: string | null;
  /** One sentence: which trait or lens it proves, overlap with essays, how a reader may see it. */
  reason: string;
  /** Null when the item leaves the form, or in coach mode (no generated prose, §14.2). */
  entry: FormEntry | null;
  /** "Add your role and a number", "Say what changed because of you". */
  stronger: string[];
  /** Details the entry needs that the dossier lacks (never invented). */
  needs: FormNeed[];
}

export interface FormSectionAdvice {
  section_key: string;
  items: FormItem[];
}

export interface CouldStillDo {
  text: string;
  why: string;
  /** "About 2 weeks", "An evening". */
  time: string;
}

/** `forms.advise` output: every form section of one school in one call. */
export interface FormAdvice {
  sections: FormSectionAdvice[];
  could_still_do: CouldStillDo[];
  verify: { text: string; reason: string }[];
}

/* Résumé Pass ----------------------------------------------------------------------------------- */

export const RESUME_SECTION_KINDS = [
  "experience",
  "education",
  "leadership",
  "skills",
  "additional",
] as const;
export type ResumeSectionKind = (typeof RESUME_SECTION_KINDS)[number];

/** §5.10 and A10: what a bullet's feedback is about. */
export const RESUME_ISSUES = [
  "activity_not_achievement",
  "lead_with_impact",
  "so_what",
  "quantify",
  "jargon",
  "weak_verb",
  "too_long",
  "duplicate",
] as const;
export type ResumeIssue = (typeof RESUME_ISSUES)[number];

export const RESUME_ISSUE_LABELS: Record<ResumeIssue, string> = {
  activity_not_achievement: "Activity, not achievement",
  lead_with_impact: "Lead with the impact",
  so_what: "So what?",
  quantify: "Add a number",
  jargon: "Translate the jargon",
  weak_verb: "Weak verb",
  too_long: "Too long",
  duplicate: "Repeats another line",
};

export const RESUME_VERDICTS = ["achievement", "activity"] as const;
export type ResumeVerdict = (typeof RESUME_VERDICTS)[number];

/** A placeholder inside a rewrite, written `[?1]`, `[?2]`…: a detail only the applicant knows. */
export const RESUME_PLACEHOLDER_RE = /\[\?(\d{1,2})\]/g;

export interface ResumeRewrite {
  text: string;
  sources: string[];
  /** One per `[?n]` placeholder in `text`, in order. */
  needs: FormNeed[];
}

export interface ResumeBullet {
  /** "b1", "b2"… unique across the résumé. */
  id: string;
  /** Word for word from the uploaded résumé. */
  original: string;
  verdict: ResumeVerdict;
  issues: ResumeIssue[];
  /** One plain sentence. */
  feedback: string;
  /** Null when the bullet is already strong. */
  rewrite: ResumeRewrite | null;
}

export interface ResumeRole {
  /** "r1", "r2"… */
  id: string;
  /** Word for word from the résumé (organisation, title, dates, location). */
  organisation: string;
  title: string | null;
  dates: string | null;
  location: string | null;
  bullets: ResumeBullet[];
}

export interface ResumeSection {
  /** "s1", "s2"… */
  id: string;
  /** Word for word from the résumé. */
  heading: string;
  kind: ResumeSectionKind;
  roles: ResumeRole[];
  /** Lines that are not bullets under a role (skills, languages, interests), word for word. */
  lines: string[];
}

/** `resume.review` output. */
export interface ResumeReview {
  header: { name: string | null; lines: string[] };
  sections: ResumeSection[];
  section_order: { order: string[]; reason: string };
  /** The three changes that matter most, plainly. */
  priorities: string[];
}

/** The applicant's decision on one bullet's rewrite. */
export type BulletDecision =
  | { status: "accepted"; answers: string[] }
  | { status: "rejected" }
  | { status: "edited"; text: string };
