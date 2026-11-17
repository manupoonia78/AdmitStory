// The reading serif for sheets of paper on the landing page: the root layout's lazy Source Serif 4
// (SPEC §8.1). "/" used to preload the roman for the hero's sheets (19.7 KB); Manu (2026-11-17)
// chose first paint over that, so the sheets set in the size-adjusted fallback for a moment and
// swap when the face arrives, with no shift.

export const sheetSerif = { className: "font-reading" } as const;
