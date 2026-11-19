// The words in the interview room's still (SPEC §6.18). A new fictional applicant (a hospital
// operations analyst in Pune) at the fictional Halvorsen, written for this preview only. The room
// is not built; the page labels this a preview.

export const ROOM_STILL = {
  label: "Preview · not available yet",
  from: "Halvorsen · from your interview plan",
  question: "Walk me through a time the numbers told you one thing and the ward told you another.",
  transcript: [
    "The bed-turnover report said we were fine.",
    "But the night nurses kept calling at two,",
    "so I spent three nights on the ward with them,",
    "and the report was counting the wrong",
  ],
  elapsed: "0:42",
  of: "of 2:00",
  /** 0:42 of 2:00. */
  fraction: 42 / 120,
  partsLabel: "What's coming",
} as const;
