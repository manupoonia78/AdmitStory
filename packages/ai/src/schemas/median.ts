import { MEDIAN_LABELS } from "@admitstory/shared/kit";
import { z } from "zod";

/** compareToMedian()'s result, computed in code and handed to a model as a given (spec §5.5). */
export const MedianComparisonInput = z.object({
  test: z.enum(MEDIAN_LABELS),
  gpa: z.enum(MEDIAN_LABELS),
  years_experience: z.enum(MEDIAN_LABELS),
});
