// Social proof (SPEC §4.1). This list ships EMPTY, and <SocialProofSlot> renders nothing while it
// is. Only Manu adds to it, and only with real, attributable words from real people who agreed to
// be quoted. Never a placeholder, a sample or an invented line: an empty list is the honest state.

export interface SocialProofItem {
  /** What they said, word for word. */
  quote: string;
  /** Who said it, as they agreed to be named. */
  by: string;
  /** Their context, as they agreed to be described ("Admitted, 2027 intake"). */
  context: string;
}

export const SOCIAL_PROOF: readonly SocialProofItem[] = [];
