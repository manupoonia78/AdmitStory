// The landing hero (direction §4.2), verbatim where the direction gives the words. The visitor's
// own sentence is never praised (§6.9), and nothing here promises more than the page does.

export const HERO_COPY = {
  eyebrow: "MBA applications, told in your own voice",
  headingLines: ["Say one thing", "about yourself."],
  headingPhoneLines: ["Say one", "thing about", "yourself."],
  subline:
    "AdmitStories listens to your life story and turns it into your MBA application, one school at a time, in your own words.",
  note: "About ten seconds with a fictional applicant. No microphone, nothing recorded.",
  writeNote: "What you type stays in this browser unless you sign up and keep it.",
  formLabel: "A Voiceprint: a form drawn from the way someone speaks",
  scrollNote: "Scroll to follow one sentence through AdmitStories",
} as const;

export const HERO_ACTIONS = {
  play: "See it happen",
  write: "Write your own line",
  place: "Place it in an essay",
  keep: "Sign up and keep this line",
  again: "Try another line",
  cancel: "Cancel",
} as const;

export const WRITE_COPY = {
  label: "Your line",
  placeholder: "The night the system went down, I…",
} as const;

export const SHEET_COPY = {
  header: "Essay 1 · first draft",
  label: "An essay sheet",
} as const;

export const CAPTION_COPY = {
  line: "Word for word, that’s your line. In AdmitStories every essay is built around sentences like it, and each one links back to the moment you said it.",
  sample:
    "The sample applicant’s line, word for word. In AdmitStories every essay is built around sentences like it, and each one links back to the moment it was said.",
} as const;

/** Spoken by screen readers when the line lands. */
export function placedAnnouncement(line: string): string {
  return `Your line is in the essay: ${line}`;
}

/** The sample's label: silent with captions until a voiced sample is generated (deviation D8). */
export const SAMPLE_LABEL = {
  voiced: "Sample voice, synthesised. The applicant is fictional.",
  silent: "Sample, shown without sound. The applicant is fictional.",
} as const;
