import { funnelOverview, type FunnelStep } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { percent } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { dollars } from "@/lib/payments/plans";
import { FREE_STUDIO_ANSWERS } from "@/lib/studio/allowance";
import { Section, table } from "../_components/fields";

export const metadata: Metadata = { title: "Funnel" };

// Funnel (16 Nov 2026): of the people who signed up in the range, how many reached each step on
// the way to buying a school, and where the most stop. Counted from the database, so it needs no
// analytics key; the PostHog events in lib/analytics/server.ts add page views and timing.

const RANGES = [7, 30, 90, 0] as const;

const STEP_LABEL: Record<FunnelStep, { label: string; detail: string }> = {
  signed_up: { label: "Signed up", detail: "Created an account" },
  first_run: { label: "Finished first-run", detail: "Answered the five opening screens" },
  answered: { label: "Answered in Story Studio", detail: "Gave at least one answer" },
  story: { label: "Told a story", detail: "At least one story on their shelf" },
  school: { label: "Added a school", detail: "At least one school on their list" },
  preview: { label: "Built a preview", detail: "A free preview, or a kit, for a school" },
  checkout: { label: "Opened checkout", detail: "Pressed pay on an unlock page" },
  paid: { label: "Paid", detail: "At least one purchase" },
};

function rangeOf(value: string | undefined): { days: number; from: Date | null; to: Date } {
  const n = Number(value);
  const days = (RANGES as readonly number[]).includes(n) ? n : 30;
  const to = new Date();
  const from =
    days === 0
      ? null
      : new Date(
          Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) -
            (days - 1) * 86_400_000,
        );
  return { days, from, to };
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const admin = await requireAdminPage();
  const range = rangeOf((await searchParams).days);
  const view = await funnelOverview(admin, {
    from: range.from,
    to: range.to,
    freeStudioAnswers: FREE_STUDIO_ANSWERS,
  });

  const signedUp = view.steps[0]?.people ?? 0;
  const paid = view.steps.at(-1)?.people ?? 0;
  const rows = view.steps.map((row, index) => {
    const before = index === 0 ? row.people : (view.steps[index - 1]?.people ?? 0);
    return { ...row, lost: Math.max(0, before - row.people), before };
  });
  const worst = rows.reduce<(typeof rows)[number] | null>(
    (most, row) => (row.lost > (most?.lost ?? 0) ? row : most),
    null,
  );
  const share = (people: number) => (signedUp === 0 ? "–" : percent(people / signedUp));

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-display text-text">Funnel</h1>
        <p className="text-sm text-text-soft">
          <Link href="/admin/orders" className="underline underline-offset-4">
            Orders
          </Link>
          {" · "}
          <Link href="/admin/users" className="underline underline-offset-4">
            Users
          </Link>
        </p>
      </div>
      <nav aria-label="Range" className="flex flex-wrap items-center gap-3 text-sm">
        {RANGES.map((days) => (
          <Link
            key={days}
            href={`?days=${days}`}
            aria-current={days === range.days ? "page" : undefined}
            className={
              days === range.days
                ? "font-semibold text-text underline underline-offset-4"
                : "text-text-soft hover:text-text"
            }
          >
            {days === 0 ? "All time" : `${days} days`}
          </Link>
        ))}
      </nav>

      <p className="text-2xl font-semibold tabular-nums text-text">
        {signedUp === 0 ? "No sign-ups" : `${paid} of ${signedUp} paid`}{" "}
        <span className="text-base font-normal text-text-soft">
          {signedUp === 0 ? "in this range." : `(${share(paid)}), of the people who signed up `}
          {signedUp === 0 ? null : range.days === 0 ? "so far." : `in the last ${range.days} days.`}
        </span>
      </p>
      {worst && worst.lost > 0 ? (
        <p className="max-w-prose text-text">
          The most people stop before the step{" "}
          <strong className="font-semibold">“{STEP_LABEL[worst.step].label}”</strong>: {worst.lost}{" "}
          of the {worst.before} who reached the step above it went no further.
        </p>
      ) : null}

      <Section title="Steps" id="steps">
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">People who reached each step</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Step
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  People
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Of sign-ups
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Stopped before it
                </th>
                <th scope="col" className={table.th}>
                  <span className="sr-only">Share of sign-ups, drawn</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.step}>
                  <th scope="row" className={`${table.td} text-left font-normal`}>
                    <span className="block font-medium text-text">
                      {STEP_LABEL[row.step].label}
                    </span>
                    <span className="block text-sm text-text-soft">
                      {STEP_LABEL[row.step].detail}
                    </span>
                  </th>
                  <td className={`${table.td} ${table.num}`}>{row.people}</td>
                  <td className={`${table.td} ${table.num}`}>{share(row.people)}</td>
                  <td
                    className={`${table.td} ${table.num} ${row === worst && row.lost > 0 ? "font-semibold text-text" : ""}`}
                  >
                    {index === 0 ? "" : row.lost}
                  </td>
                  <td className={`${table.td} w-1/4`} aria-hidden>
                    <span className="block h-2 w-full overflow-hidden rounded-full bg-veil">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{
                          width: `${signedUp === 0 ? 0 : Math.round((row.people / signedUp) * 100)}%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-prose text-sm text-text-soft">
          Each row counts everyone who reached that step, in the order an applicant meets them.
          Someone can add a school before telling a story, so a row can be larger than the one above
          it. Staff accounts are left out.
        </p>
      </Section>

      <Section title="The free Studio limit" id="studio-limit">
        <p className="text-text">
          {view.studioLimit.reached === 0
            ? `Nobody in this range has used all ${FREE_STUDIO_ANSWERS} free answers yet.`
            : `${view.studioLimit.reached} used all ${FREE_STUDIO_ANSWERS} free answers; ${view.studioLimit.paid} of them paid (${percent(view.studioLimit.paid / view.studioLimit.reached)}).`}
        </p>
      </Section>

      <Section title="What they bought" id="bought">
        {view.purchases.length === 0 ? (
          <p className="text-text-soft">No purchases from this range.</p>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Purchases by size</caption>
              <thead>
                <tr>
                  <th scope="col" className={table.th}>
                    Purchase
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Count
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.purchases.map((row) => (
                  <tr key={row.schools}>
                    <td className={table.td}>
                      {row.schools === 1 ? "1 school" : `${row.schools}-school pack`}
                    </td>
                    <td className={`${table.td} ${table.num}`}>{row.count}</td>
                    <td className={`${table.td} ${table.num}`}>{dollars(row.cents)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className={`${table.td} text-left font-semibold`}>
                    Total
                  </th>
                  <td className={`${table.td} ${table.num}`}>
                    {view.purchases.reduce((sum, row) => sum + row.count, 0)}
                  </td>
                  <td className={`${table.td} ${table.num} font-semibold`}>
                    {dollars(view.revenueCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="max-w-prose text-sm text-text-soft">
          Purchases that still stand (refunds and chargebacks left out), in the currency charged.
        </p>
      </Section>
    </>
  );
}
