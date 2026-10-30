// A token estimate for text we are about to send, used only to keep the compact dossier inside its
// budget (spec §8.5.3) and to fill `dossier_snapshots.token_count`. It is deliberately a local
// heuristic: the compiler must be pure and synchronous, and a network call to count tokens on every
// consolidation would cost more than the budget it protects. Real token counts in the ledger and
// the cost dashboard always come from the API response (§8.4 step 7), never from here.
//
// The heuristic: Claude's tokenizer averages roughly 3.5–4 characters per token on English prose,
// and fewer on the dossier's dense ID-and-punctuation lines, so counting whitespace-separated
// chunks and charging long ones by length tracks it more closely than characters alone. It is
// tuned to read high rather than low, because under-reading would push a request over the budget
// it exists to protect. It has NOT been calibrated against the real tokenizer: no API key was
// available when this was written. Once one is, compare it with the count_tokens endpoint on a
// few real snapshots and adjust CHARS_PER_TOKEN.

const CHARS_PER_TOKEN = 3.6;

/** Approximate tokens in a string. Never returns less than 1 for non-empty text. */
export function estimateTokens(text: string): number {
  if (text.trim() === "") return 0;
  let tokens = 0;
  for (const chunk of text.split(/\s+/)) {
    if (chunk === "") continue;
    // Short words are a token each; longer ones split roughly by length. Punctuation attached to a
    // word usually costs its own token, which the ceiling below absorbs.
    tokens += chunk.length <= 4 ? 1 : Math.ceil(chunk.length / CHARS_PER_TOKEN);
  }
  // Newlines are tokens too, and the dossier is line-dense.
  const newlines = text.length - text.replaceAll("\n", "").length;
  return Math.max(1, tokens + Math.ceil(newlines / 2));
}

/** Spec §8.5.3: the Consolidator targets a snapshot of 10K tokens or less. */
export const DOSSIER_TOKEN_BUDGET = 10_000;

/** Spec §5.3d: the Writer gets a compact voice card, not raw transcripts. */
export const VOICE_CARD_TOKEN_BUDGET = 300;
