// "Write your own line": the browser-only toy that used to open from the hero. It is rebuilt in
// the paper scene, "Essays that show their thinking" (SPEC §4, scene 5), in Phase 3; its words wait
// here, and its text clean-up in ../_hero/line-cleanup.ts. The visitor's own sentence is never
// praised, and nothing typed leaves the browser.

export const WRITE_ACTIONS = {
  write: "Write your own line",
  place: "Place it in an essay",
  keep: "Sign up and keep this line",
  again: "Try another line",
  cancel: "Cancel",
} as const;

export const WRITE_COPY = {
  label: "Your line",
  placeholder: "The night the system went down, I…",
  note: "What you type stays in this browser unless you sign up and keep it.",
} as const;

export const WRITE_CAPTION =
  "Word for word, that’s your line. In AdmitStories every essay is built around sentences like it, and each one links back to the moment you said it.";

/** Spoken by screen readers when the line lands. */
export function placedAnnouncement(line: string): string {
  return `Your line is in the essay: ${line}`;
}
