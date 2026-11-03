// Copy every marketing page shares (direction §4.7, §4.8, §2). Sentence case, no "!", honest per
// spec §14.5. The honest-claims scan reads every string exported from _copy/*.ts.

import { COMING_SOON } from "@/lib/deferred/coming-soon";

/** Under every appearance of the sample applicant (direction §4 overview). */
export const FICTIONAL_NOTE = "A sample applicant. Fictional, as is Northfield.";

/**
 * Interview practice is deferred past launch (Manu, 2 Nov 2026). COMING_SOON is the app's own
 * (lib/deferred/coming-soon.ts). The line below must stay identical to INTERVIEW_COMING_SOON.promise
 * in lib/interview/coming-soon.ts; it isn't imported because that object's other copy would ride
 * into the marketing pages' first load. Grep for COMING_SOON to find every place to change when
 * Phase 7 ships.
 */
export { COMING_SOON };
export const INTERVIEW_COMING_SOON_LINE =
  "Interview practice is coming soon. Kit owners get it at no extra cost when it opens.";

/** What AdmitStory won't do (direction §4.7), used on /, /how-it-works and /terms. */
export const INTEGRITY_LINES = [
  "It won't invent a story, a number or a quote. If something's missing, it asks you.",
  "It won't promise admission, or tell you your odds.",
  "It won't write your recommenders' letters. It gives them a brief; they write the letter.",
  "It follows each school's rules on AI. Where a school asks you to disclose AI help, it drafts an honest disclosure for you to edit. Where a school doesn't allow AI-written answers, it coaches instead of writing.",
  // No audio-retention opt-in at launch (Phase 2: the keep_audio toggle isn't shown).
  "It doesn't keep your voice. Audio is turned into text and discarded.",
] as const;

/** The refund rule, verbatim wherever it appears (pricing, /pricing, /terms, the FAQ). */
export const REFUND_RULE =
  "Full refund within 7 days if you haven't marked anything final and have used fewer than 3 refinements.";

export const TAX_LINE = "Prices in US dollars. Tax is added at checkout where it applies.";

/** The AI-policy fallback before Manu verifies any policy (direction §4.7, §6). */
export const AI_POLICY_FALLBACK =
  "Each school's policy is shown in the app with the date we checked it.";

export const START_FREE = "Start free";
export const SIGN_IN = "Sign in";
