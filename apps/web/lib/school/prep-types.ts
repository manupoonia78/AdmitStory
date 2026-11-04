// The school page's prep steps, as plain values client screens can import (lib/school/prep.ts
// loads them on the server).

/** Fewer stories than this and the drafts lean on too little. */
export const ENOUGH_STORIES = 4;

export interface SchoolPrep {
  userSchoolId: string;
  cycle: string;
  stories: number;
  goalsSet: boolean;
  /** Stories told after this kit started: a rebuild would use them. */
  storiesSinceKit: number;
  /** From School Strategy's fit read: what the school values, matched to the applicant. */
  offers: { value: string; note: string }[];
  outcome: string | null;
}
