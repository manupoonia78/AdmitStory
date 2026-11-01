// Test-only fixtures (not exported from the barrel). Fictional stories.

import type { LensReading } from "./types";

export const READINGS: LensReading[] = [
  {
    lens: "academics",
    level: "partial",
    stories: [{ id: "S01", title: "The statistics retake", context: "University, 2016" }],
  },
  { lens: "self_awareness", level: "thin", stories: [] },
  {
    lens: "employability",
    level: "strong",
    stories: [
      { id: "S02", title: "The night-shift fix", context: "Work, 2024", weight: 2 },
      { id: "S03", title: "The vendor audit", context: "Work, 2022" },
    ],
  },
  {
    lens: "leadership",
    level: "partial",
    stories: [
      { id: "S02", title: "The night-shift fix", context: "Work, 2024" },
      { id: "S04", title: "Eight people in a park", context: "Community, 2021" },
      { id: "S05", title: "The intern cohort", context: "Work, 2023" },
    ],
  },
];
