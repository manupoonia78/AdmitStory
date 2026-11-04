import { z } from "zod";

/** The narrative the résumé tells, as the Résumé page sends it. */
export const NarrativeBody = z.strictObject({
  goal: z.string().trim().max(400),
  thread: z.string().trim().max(600),
  notes: z.string().trim().max(1_000),
});
