// The admin Funnel page (16 Nov 2026): how far the people who signed up in a range got on the way
// to buying a school, counted from the tables themselves, so it works without an analytics key and
// covers every account since the first. Staff accounts (expert, guide, admin) are left out.
//
// Each step counts the people who reached it, whatever else they did; the steps are listed in the
// order an applicant meets them, so the gaps between them are where people stop.

import { and, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { purchases, users } from "../schema";
import { adminDb, type AdminContext } from "./admin";

export const FUNNEL_STEPS = [
  "signed_up",
  "first_run",
  "answered",
  "story",
  "school",
  "preview",
  "checkout",
  "paid",
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface FunnelView {
  /** People who reached each step, in FUNNEL_STEPS order. */
  steps: { step: FunnelStep; people: number }[];
  /** The free Studio limit: how many hit it, and how many of those went on to pay. */
  studioLimit: { reached: number; paid: number };
  /** Purchases made by this cohort that still stand, by how many schools each bought. */
  purchases: { schools: number; count: number; cents: number }[];
  revenueCents: number;
}

/** A correlated subquery over one sign-up; `users` is the outer table. */
const reached = (subquery: string): SQL<number> =>
  sql<number>`count(*) filter (where exists (${sql.raw(subquery)}))::int`;

const OWNED = `"users"."id"`;
const SUBQUERY: Record<Exclude<FunnelStep, "signed_up">, string> = {
  first_run: `select 1 from profiles p where p.user_id = ${OWNED} and p.first_run_completed_at is not null`,
  answered: `select 1 from studio_turns t where t.user_id = ${OWNED} and t.role = 'user'`,
  story: `select 1 from stories s where s.user_id = ${OWNED} and s.merged_into is null`,
  school: `select 1 from user_schools us where us.user_id = ${OWNED}`,
  preview: `select 1 from kits k where k.user_id = ${OWNED}`,
  checkout: `select 1 from checkouts c where c.user_id = ${OWNED}`,
  paid: `select 1 from purchases pu where pu.user_id = ${OWNED}`,
};

export async function funnelOverview(
  admin: AdminContext,
  opts: { from: Date | null; to: Date; freeStudioAnswers: number },
): Promise<FunnelView> {
  const db = adminDb(admin);
  const limit = Math.max(1, Math.trunc(opts.freeStudioAnswers));
  const cohort = and(
    opts.from ? gte(users.createdAt, opts.from) : undefined,
    lt(users.createdAt, opts.to),
    sql`not exists (select 1 from roles r where r.user_id = ${users.id} and r.role <> 'applicant')`,
  ) as SQL;
  const atLimit = `(select count(*) from studio_turns t where t.user_id = ${OWNED} and t.role = 'user') >= ${limit}`;

  const [[counts], bought] = await Promise.all([
    db
      .select({
        signed_up: sql<number>`count(*)::int`,
        first_run: reached(SUBQUERY.first_run),
        answered: reached(SUBQUERY.answered),
        story: reached(SUBQUERY.story),
        school: reached(SUBQUERY.school),
        preview: reached(SUBQUERY.preview),
        checkout: reached(SUBQUERY.checkout),
        paid: reached(SUBQUERY.paid),
        limitReached: sql<number>`count(*) filter (where ${sql.raw(atLimit)})::int`,
        limitPaid: sql<number>`count(*) filter (where ${sql.raw(atLimit)} and exists (${sql.raw(SUBQUERY.paid)}))::int`,
      })
      .from(users)
      .where(cohort),
    db
      .select({
        schools: purchases.schools,
        count: sql<number>`count(*)::int`,
        cents: sql<number>`coalesce(sum(${purchases.amountCents}), 0)::int`,
      })
      .from(purchases)
      .innerJoin(users, eq(users.id, purchases.userId))
      .where(and(cohort, inArray(purchases.status, ["completed", "partially_refunded"])))
      .groupBy(purchases.schools)
      .orderBy(purchases.schools),
  ]);

  return {
    steps: FUNNEL_STEPS.map((step) => ({ step, people: counts?.[step] ?? 0 })),
    studioLimit: { reached: counts?.limitReached ?? 0, paid: counts?.limitPaid ?? 0 },
    purchases: bought,
    revenueCents: bought.reduce((sum, row) => sum + row.cents, 0),
  };
}
