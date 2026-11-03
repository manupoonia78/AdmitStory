import "server-only";

import {
  getKitContext,
  listLorBriefs,
  listRecommenders,
  type DbExecutor,
  type LorBriefRow,
} from "@admitstory/db";
import type { ConsistencyDoc } from "@admitstory/linters";

// The recommender briefs as consistency documents (spec §5.10, canon FORM-01, kind "brief"): a
// brief that says "a team of 15" where the Fact Sheet says 13 is a mismatch the applicant should
// see before the letter goes out. Only ready briefs join, and only their talking points, strengths,
// arc and key facts — the cover note is a note to the recommender, not a claim about the file.

const briefDocId = (recommenderId: string, groupKey: string) =>
  `brief:${recommenderId}:${groupKey}`;

function segmentsOf(row: LorBriefRow): ConsistencyDoc["segments"] {
  const brief = row.content;
  if (!brief) return [];
  const segments: ConsistencyDoc["segments"] = [];
  for (const school of brief.schools)
    for (const question of school.questions)
      question.talking_points.forEach((point, i) =>
        segments.push({
          ref: `${school.school_cycle_id}.${question.question_id}.p${i + 1}`,
          text: `${point.point} ${point.evidence}`.trim(),
        }),
      );
  brief.traits_to_reinforce.forEach((trait, i) =>
    segments.push({ ref: `trait${i + 1}`, text: trait.why }),
  );
  const arc = brief.development_arc;
  if (arc)
    segments.push({
      ref: "arc",
      text: [arc.feedback, arc.response, ...arc.steps, arc.evidence].join(" "),
    });
  brief.key_facts.forEach((fact, i) => segments.push({ ref: `fact${i + 1}`, text: fact.text }));
  return segments.filter((s) => s.text.length > 0);
}

/**
 * The applicant's ready briefs as consistency documents (kind "brief"), so a brief that says
 * "team of 15" is flagged against the Fact Sheet. `kitId` keeps the briefs covering that kit's
 * school; without it, every brief.
 */
export async function briefConsistencyDocs(
  db: DbExecutor,
  userId: string,
  scope: { kitId?: string } = {},
): Promise<ConsistencyDoc[]> {
  const briefs = (await listLorBriefs(db, userId)).filter(
    (b) => b.status === "ready" && b.content !== null,
  );
  if (briefs.length === 0) return [];
  const schoolCycleId = scope.kitId
    ? ((await getKitContext(db, userId, scope.kitId))?.schoolCycleId ?? null)
    : null;
  const scoped = schoolCycleId
    ? briefs.filter((b) => b.schoolCycleIds.includes(schoolCycleId))
    : briefs;
  if (scoped.length === 0) return [];
  const people = await listRecommenders(db, userId, { includeArchived: true });
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  return scoped.flatMap((row) => {
    const segments = segmentsOf(row);
    if (segments.length === 0) return [];
    const who = nameOf.get(row.recommenderId) ?? "Recommender";
    const schools = (row.meta?.schools ?? []).map((s) => s.school).join(", ");
    return [
      {
        id: briefDocId(row.recommenderId, row.groupKey),
        kind: "brief" as const,
        label: schools ? `${who}'s brief: ${schools}` : `${who}'s brief`,
        segments,
      },
    ];
  });
}
