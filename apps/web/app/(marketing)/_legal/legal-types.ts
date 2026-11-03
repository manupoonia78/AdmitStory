// The shape of a legal page (direction §7–8): sections with a plain summary on the left and the
// full text on the right. Plain data, so the copy files stay strings the honest-claims scan reads.

/** A paragraph, or a bulleted list. */
export type LegalBlock = string | { readonly list: readonly string[] };

export interface LegalSection {
  /** The heading's anchor, unique on the page. */
  id: string;
  title: string;
  /** One or two plain sentences (Newsreader, left column). */
  summary: string;
  body: readonly LegalBlock[];
}

/** Both pages carry a draft note until counsel has reviewed them (spec §14.4). */
export const LEGAL_DRAFT = true;
export const LEGAL_DRAFT_NOTE = "This page is a draft under legal review.";
/** Shown as "Last updated 3 November 2026". */
export const LEGAL_UPDATED = "2026-11-03";
