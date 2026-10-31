// Spec Appendix H: the v1 seed schools. Phase 3 creates `schools` rows from this list; Phase 2 uses
// the names as Deepgram keyterms so dictation spells them right. Names as the spec writes them.

export type SeedSchoolRegion = "us" | "europe" | "asia_other";

export interface SeedSchool {
  name: string;
  region: SeedSchoolRegion;
}

const us = [
  "Harvard Business School",
  "Stanford GSB",
  "Wharton (Penn)",
  "Chicago Booth",
  "Northwestern Kellogg",
  "MIT Sloan",
  "Columbia Business School",
  "Berkeley Haas",
  "Dartmouth Tuck",
  "Yale SOM",
  "Michigan Ross",
  "Duke Fuqua",
  "UVA Darden",
  "NYU Stern",
  "Cornell Johnson",
  "UCLA Anderson",
  "CMU Tepper",
  "UT Austin McCombs",
  "USC Marshall",
  "UW Foster",
  "UNC Kenan-Flagler",
  "Emory Goizueta",
  "Vanderbilt Owen",
  "Georgia Tech Scheller",
  "Indiana Kelley",
  "Rice Jones",
  "WashU Olin",
  "Notre Dame Mendoza",
  "Rochester Simon",
  "Minnesota Carlson",
];

const europe = [
  "INSEAD",
  "London Business School",
  "HEC Paris",
  "IESE",
  "IE Business School",
  "ESADE",
  "SDA Bocconi",
  "Oxford Saïd",
  "Cambridge Judge",
  "IMD",
];

const asiaOther = [
  "ISB (India)",
  "NUS Business School",
  "HKUST",
  "CEIBS",
  "Melbourne Business School",
  "Ivey (Canada)",
  "Rotman (Canada)",
];

export const SEED_SCHOOLS: readonly SeedSchool[] = [
  ...us.map((name) => ({ name, region: "us" as const })),
  ...europe.map((name) => ({ name, region: "europe" as const })),
  ...asiaOther.map((name) => ({ name, region: "asia_other" as const })),
];

/** A school's spoken name: the spec's parenthetical (a parent university or a country) dropped. */
export const spokenSchoolName = (name: string): string =>
  name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
