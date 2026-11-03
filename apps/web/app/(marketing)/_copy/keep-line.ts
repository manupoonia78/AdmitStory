// "Keep this line" (direction §4.2, plan §5): the words on /sign-in?from=line, in first run and in
// Story Studio's first question. Sentence case, no praise of what the visitor said (§6.9).

export const KEEP_LINE_COPY = {
  /** /sign-in?from=line, above the kept line. */
  signInHeading: "Keep your first line",
  /** First run, last step; on by default, shown only when a line was kept. */
  firstRunCheckbox: "Start Story Studio with the line you said on our homepage",
} as const;

/**
 * Story Studio's seed for its first question (the Interviewer phrases it). The line is quoted
 * exactly as the visitor said it.
 */
export function homepageOpenerQuestion(line: string): string {
  return `On our homepage you said: “${line}” Tell me what happened next.`;
}
