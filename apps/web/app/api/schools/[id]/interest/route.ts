import { getDb, listSeedSchools, voteForSchool, withdrawSchoolVote } from "@admitstory/db";
import { z } from "zod";
import { checkRateLimit, handle, notFound, requireUser, ApiError } from "@/lib/api";
import { STRATEGY_LIMITS } from "@/lib/strategy/page-data";

// POST/DELETE /api/schools/:id/interest (spec §5.5, §9.5): "Ask us to cover {School}" for a school
// whose pack isn't published. It records interest only; it never makes the school purchasable.
// Repeating it is harmless (one vote per applicant and school).

const Id = z.guid();

async function schoolFor(id: string) {
  const parsed = Id.safeParse(id);
  if (!parsed.success) notFound("That school");
  const school = (await listSeedSchools(getDb())).find((s) => s.id === parsed.data);
  if (!school) notFound("That school");
  return school;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("strategyWrites", session.user.id, STRATEGY_LIMITS.writes);
    const school = await schoolFor((await context.params).id);
    if (school.publishedPack)
      throw new ApiError(
        409,
        `${school.shortName}'s pack is published. Add it to your list instead.`,
      );
    await voteForSchool(getDb(), session.user.id, school.id);
    return Response.json({ asked: true });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { session } = await requireUser();
    checkRateLimit("strategyWrites", session.user.id, STRATEGY_LIMITS.writes);
    const school = await schoolFor((await context.params).id);
    await withdrawSchoolVote(getDb(), session.user.id, school.id);
    return Response.json({ asked: false });
  });
}
