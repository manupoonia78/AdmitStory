import { getDb, searchConnectPeople } from "@admitstory/db";
import { z } from "zod";
import { RATE_LIMITS, checkRateLimit, handle, requireUser } from "@/lib/api";
import { personDto, requireConnect } from "@/lib/connect/server";
import { assertFeatureOn } from "@/lib/features";

// GET /api/connect/people?q=&school=&relation= : the Connect directory search, for pack owners.
// The applicant's own schools sort first, after the people who work with us.

const Query = z.object({
  q: z.string().trim().max(120).optional(),
  school: z.guid().optional(),
  relation: z.enum(["alum", "student", "adcom"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    await assertFeatureOn("connect");
    const { session } = await requireUser();
    const userId = session.user.id;
    await checkRateLimit("connectSearch", userId, RATE_LIMITS.connectSearch);
    const access = await requireConnect(userId);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = Query.parse(
      Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "")),
    );
    const people = await searchConnectPeople(getDb(), {
      q: query.q,
      schoolId: query.school,
      relation: query.relation,
      preferSchoolIds: access.unlockedSchoolIds,
    });
    return Response.json({ people: people.map(personDto) });
  });
}
