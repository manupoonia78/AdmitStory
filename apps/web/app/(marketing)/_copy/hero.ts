// The landing hero (direction §4.2), verbatim where the direction gives the words. The visitor's
// own sentence is never praised (§6.9), and nothing here promises more than the page does.

export const HERO_COPY = {
  eyebrow: "MBA applications, told in your own voice",
  headingLines: ["Say one thing", "about yourself."],
  headingPhoneLines: ["Say one", "thing about", "yourself."],
  subline:
    "AdmitStories listens to your life story and turns it into your MBA application, one school at a time, in your own words.",
  privacy:
    "Fifteen seconds. Your audio is turned into text and not kept, and neither is the text unless you sign up.",
  formLabel: "A Voiceprint: a form drawn from the way someone speaks",
  scrollNote: "Scroll to follow one sentence through AdmitStories",
} as const;

export const HERO_ACTIONS = {
  speak: "Speak for 15 seconds",
  done: "Done",
  sample: "Play a sample",
  write: "Write instead",
  place: "Place it in an essay",
  keep: "Sign up and keep this line",
  again: "Say it again",
  ownLine: "Say your own line",
} as const;

/** The microphone explainer (§6.9, verbatim, cased "AdmitStories"). */
export const MIC_EXPLAINER = {
  text: "AdmitStories needs your microphone to hear your answers. Audio is turned into text and not kept unless you choose to.",
  allow: "Allow microphone",
  write: "Write instead",
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
  voiceprint: "That’s your Voiceprint, drawn from how you spoke. It’s yours across AdmitStories.",
  sample:
    "The sample applicant’s line, word for word. In AdmitStories every essay is built around sentences like it, and each one links back to the moment it was said.",
} as const;

export function fillersLine(count: number): string {
  return count === 1
    ? "We removed 1 filler word. Nothing else changed."
    : `We removed ${count} filler words. Nothing else changed.`;
}

/** Spoken by screen readers when the line lands. */
export function placedAnnouncement(line: string): string {
  return `Your line is in the essay: ${line}`;
}

export function recordingStatus(secondsLeft: number): string {
  return `Recording, ${secondsLeft} ${secondsLeft === 1 ? "second" : "seconds"} left`;
}

/** The sample's label: silent with captions until a voiced sample is generated (deviation D8). */
export const SAMPLE_LABEL = {
  voiced: "Sample voice, synthesised. The applicant is fictional.",
  silent: "Sample, shown without sound. The applicant is fictional.",
} as const;

/** Empty and error states (direction §4.2). No "oops"; the page never blocks. */
export const HERO_NOTICES = {
  nothing_heard: "We didn’t catch anything. Try again, or write it instead.",
  mic_blocked: "Microphone is blocked in your browser settings. You can keep going by typing.",
  paused:
    "Speaking is paused on this page right now. You can write your line instead, or play the sample.",
  turnstile: "We couldn’t confirm this browser. Write your line instead, or try again in a minute.",
} as const;
