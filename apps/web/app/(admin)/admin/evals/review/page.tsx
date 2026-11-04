import { isoWeek, ratingQueue, ratingsThisWeek } from "@admitstory/db";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/guard";
import { ReviewQueue } from "./review-queue";

export const metadata: Metadata = { title: "Ratings" };

/**
 * The weekly human rating queue (spec §8.11): ten items, one at a time, scored 1–5. Synthetic eval
 * outputs, plus drafts of applicants who switched on "Help improve AdmitStories"; nobody else's.
 */
export default async function ReviewPage() {
  const admin = await requireAdminPage();
  const week = isoWeek(new Date());
  const [items, done] = await Promise.all([
    ratingQueue(admin, week, 10),
    ratingsThisWeek(admin, week),
  ]);
  return (
    <>
      <h1 className="text-display text-text">Ratings, week {week.split("-W")[1]}</h1>
      <p className="max-w-prose text-text-soft">
        Ten a week keeps the judge honest. Keys: 1–5 to score, J and K to move. {done} saved this
        week.
      </p>
      {items.length === 0 ? (
        <p className="text-text-soft">Nothing to rate yet. Run the eval suite to make samples.</p>
      ) : (
        <ReviewQueue items={items} />
      )}
    </>
  );
}
