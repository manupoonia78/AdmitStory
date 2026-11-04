// The schools with a verified pack for the 2026–27 cycle (knowledge/schools/*/2026-27), as the
// landing page's school strip names them. Keep in step with the packs that are published.

export interface CoveredSchool {
  name: string;
  /** Where it is, in the mono meta line under the name. */
  place: string;
}

export const COVERED_SCHOOLS: readonly CoveredSchool[] = [
  { name: "Harvard Business School", place: "Boston" },
  { name: "Stanford GSB", place: "Stanford" },
  { name: "Wharton", place: "Philadelphia" },
  { name: "MIT Sloan", place: "Cambridge" },
  { name: "Kellogg", place: "Evanston" },
  { name: "HEC Paris", place: "Jouy-en-Josas" },
  { name: "Tuck", place: "Hanover" },
  { name: "Fuqua", place: "Durham" },
  { name: "Darden", place: "Charlottesville" },
  { name: "Johnson", place: "Ithaca" },
  { name: "Anderson", place: "Los Angeles" },
  { name: "Tepper", place: "Pittsburgh" },
  { name: "McCombs", place: "Austin" },
  { name: "Marshall", place: "Los Angeles" },
  { name: "Foster", place: "Seattle" },
  { name: "Owen", place: "Nashville" },
];
