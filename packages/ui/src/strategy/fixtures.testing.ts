// Test-only fixtures (not exported from the barrel). Fictional schools, fictional numbers.

import type { Citation, HorizonSchool } from "./types";

export const DEADLINES: Citation = {
  source: "Deadlines page",
  year: 2026,
  url: "https://northfield.example.edu/deadlines",
  verifiedOn: "2026-09-12",
};

export const NOW = "2026-10-31T09:00:00Z";
export const TZ = "Asia/Kolkata";

export const SCHOOLS: HorizonSchool[] = [
  {
    id: "northfield",
    name: "Northfield",
    pack: "published",
    citation: DEADLINES,
    plannedRoundId: "r2",
    rounds: [
      { id: "r1", label: "Round 1", short: "R1", deadline: "2026-09-08T23:59:00-04:00" },
      { id: "r2", label: "Round 2", short: "R2", deadline: "2027-01-06T23:59:00-05:00" },
    ],
  },
  {
    id: "harbor",
    name: "Harbor",
    pack: "published",
    citation: { ...DEADLINES, verifiedOn: "2026-09-20" },
    rounds: [
      { id: "r1", label: "Round 1", short: "R1", deadline: "2026-10-01T12:00:00Z" },
      { id: "r2", label: "Round 2", short: "R2", deadline: "2027-01-09T12:00:00Z" },
    ],
  },
  { id: "westbridge", name: "Westbridge", pack: "coming_soon" },
];
