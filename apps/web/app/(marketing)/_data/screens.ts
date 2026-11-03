// The "Real screens" exhibits (direction §4.5, plan §3.7): captures of the real app, never
// mock-ups. Package C's capture script writes public/marketing/screens/{id}.avif and rewrites
// ./screens-captured.ts with the ids it captured, so a missing capture is left out rather than
// shown broken.
//
// Foundation note: availability is a generated list, not an existsSync() on public/, because a
// serverless function on Vercel doesn't carry public/ in its file trace.
//
// Interview practice is "Coming soon" (plan OVERRIDE): no interview screen is shown. The fifth
// exhibit is the Résumé Pass (Phase 5) instead of the interview report or the live-mock duet.

import { CAPTURED_SCREENS } from "./screens-captured";

export const SCREEN_IDS = [
  "dossier",
  "profile-read",
  "strategy",
  "workspace",
  "resume-pass",
] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export interface ScreenCapture {
  id: ScreenId;
  /** Public path of the AVIF capture. */
  file: string;
  width: 1760;
  height: 1120;
  /** What the capture shows, for screen readers. */
  alt: string;
  /** Geist 600, 17 px. */
  name: string;
  /** One UI 15 sentence. */
  caption: string;
}

const capture = (id: ScreenId, name: string, caption: string, alt: string): ScreenCapture => ({
  id,
  file: `/marketing/screens/${id}.avif`,
  width: 1760,
  height: 1120,
  alt,
  name,
  caption,
});

export const SCREENS: readonly ScreenCapture[] = [
  capture(
    "dossier",
    "Dossier",
    "Your stories, placed by when they happened and what they prove.",
    "The Dossier in Night: a constellation of the sample applicant's stories, placed by year and by what each one shows.",
  ),
  capture(
    "profile-read",
    "Profile Read",
    "How an admissions reader is likely to see you, with the stories behind each part.",
    "The Profile Read: four lenses on the sample applicant's file, each with the stories behind it.",
  ),
  capture(
    "strategy",
    "School Strategy",
    "Rounds and deadlines on one line. Pick two schools to compare them.",
    "School Strategy: a horizon line of rounds and deadlines for the sample applicant's schools.",
  ),
  capture(
    "workspace",
    "Workspace",
    "Every draft explains itself: why this story, why this angle, why option A.",
    "The Workspace: an essay for a fictional school with the Coach open beside it.",
  ),
  capture(
    "resume-pass",
    "Résumé Pass",
    "Your résumé, tightened line by line, with every change shown.",
    "The Résumé Pass: the sample applicant's résumé with suggested changes beside each line.",
  ),
];

/** True when the capture for `id` exists (the capture script lists it). */
export function screenAvailable(id: ScreenId): boolean {
  return (CAPTURED_SCREENS as readonly string[]).includes(id);
}

/** The exhibits that can be shown, in order. */
export function availableScreens(): ScreenCapture[] {
  return SCREENS.filter((screen) => screenAvailable(screen.id));
}
