import "server-only";

import { getLorPlan, listLorStories, listRecommenders, type DbExecutor } from "@admitstory/db";

// What this school's recommenders cover, for WhyThisDraft (plan §8): short lines from the coverage
// plan's facets, so an essay can leave a side of a story to the person who saw it.

/** At most two lines per recommender keeps the panel readable. */
const PER_RECOMMENDER = 2;

/**
 * What this school's recommenders cover, from the coverage plan's facets, as short plain lines
 * for WhyThisDraft ("Ravi: how you brought the vendor round"). [] without a plan.
 */
export async function recommenderCoversFor(
  db: DbExecutor,
  userId: string,
  userSchoolId: string,
): Promise<string[]> {
  const [plan, people] = await Promise.all([
    getLorPlan(db, userId),
    listRecommenders(db, userId, { userSchoolId }),
  ]);
  if (!plan || people.length === 0) return [];
  const stories = await listLorStories(db, userId);
  const titleOf = new Map(stories.map((s) => [s.code, s.fields.title]));
  const lines: string[] = [];
  for (const person of people) {
    const assignment = plan.content.assignments.find((a) => a.recommender === person.ref);
    if (!assignment) continue;
    const first = person.name.trim().split(/\s+/)[0] ?? person.name;
    for (const facet of assignment.facets.slice(0, PER_RECOMMENDER)) {
      const title = titleOf.get(facet.story);
      lines.push(`${first}: ${facet.facet}${title ? ` (${title})` : ""}`);
    }
  }
  return lines;
}
