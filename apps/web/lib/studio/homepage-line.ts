// The line a visitor said on the homepage, carried into Story Studio (plan §5 step 4). First run
// stores it as a conversation_note source with meta.origin "homepage_line"; the very first question
// of the applicant's first conversation then quotes it, once. Pure, so turn.ts stays thin.

import { homepageOpenerQuestion } from "@/app/(marketing)/_copy/keep-line";

export const HOMEPAGE_LINE_ORIGIN = "homepage_line";

export interface HomepageLineSource {
  id: string;
  text: string;
  meta: Record<string, unknown> | null;
}

/** The newest homepage line that hasn't opened a conversation yet, if any. */
export function unusedHomepageLine(
  sources: readonly HomepageLineSource[],
): HomepageLineSource | null {
  return (
    sources.find(
      (source) =>
        source.meta?.origin === HOMEPAGE_LINE_ORIGIN &&
        source.meta.usedAt === undefined &&
        source.text.trim() !== "",
    ) ?? null
  );
}

/**
 * The seed question quoting the line, only for a session with no turns yet and a line nobody has
 * used; otherwise undefined and Studio asks as it always does.
 */
export function homepageOpener(input: {
  turnsInSession: number;
  source: HomepageLineSource | null;
}): string | undefined {
  if (input.turnsInSession > 0 || !input.source) return undefined;
  return homepageOpenerQuestion(input.source.text.trim());
}
