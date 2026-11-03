import { isoWeek, saveRating } from "@admitstory/db";
import { RatingInput } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { adminRoute } from "@/lib/admin/guard";

// POST /api/admin/evals/ratings (§8.11): one human rating, 1–5, for this ISO week's queue.
export const POST = adminRoute(async (admin, request) => {
  const body = await readJson(request, RatingInput);
  await saveRating(admin, { ...body, week: isoWeek(new Date()) });
  return new Response(null, { status: 204 });
});
