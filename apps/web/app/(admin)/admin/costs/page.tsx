import { costsOverview } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { COST_RANGES, costRange, percent, usd } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { Section, table } from "../_components/fields";
import { SpendStrip } from "../_components/spend-strip";

export const metadata: Metadata = { title: "Costs" };

/** Costs (spec §5.18, §8.4): what the AI and voice providers cost, from usage_ledger. */
export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; replay?: string }>;
}) {
  const admin = await requireAdminPage();
  const params = await searchParams;
  const range = costRange(params.days, params.replay);
  const view = await costsOverview(admin, range);
  const query = (days: number, replay: boolean) => `?days=${days}${replay ? "&replay=1" : ""}`;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-display-sm text-text">Costs</h1>
        <p className="text-sm text-text-soft">
          <Link href="/admin/routing" className="underline underline-offset-4">
            Routing
          </Link>
          {" · "}
          <Link href="/admin/switches" className="underline underline-offset-4">
            Switches
          </Link>
        </p>
      </div>
      <nav aria-label="Range" className="flex flex-wrap items-center gap-3 text-sm">
        {COST_RANGES.map((days) => (
          <Link
            key={days}
            href={query(days, range.includeReplay)}
            aria-current={days === range.days ? "page" : undefined}
            className={
              days === range.days
                ? "font-semibold text-text underline underline-offset-4"
                : "text-text-soft hover:text-text"
            }
          >
            {days} days
          </Link>
        ))}
        <span aria-hidden className="text-edge">
          |
        </span>
        <Link
          href={query(range.days, !range.includeReplay)}
          className="text-text-soft underline underline-offset-4 hover:text-text"
        >
          {range.includeReplay ? "Hide replay rows" : "Include replay rows"}
        </Link>
        <a
          href={`/api/admin/costs/export${query(range.days, range.includeReplay)}`}
          className="ml-auto text-text underline underline-offset-4"
          download
        >
          Download CSV
        </a>
      </nav>

      <p className="text-2xl font-semibold tabular-nums text-text">
        {usd(view.totalUsd)}{" "}
        <span className="text-base font-normal text-text-soft">
          over {range.days} days{range.includeReplay ? ", replay included" : ""}
        </span>
      </p>

      {view.byDay.length === 0 ? (
        <p className="text-text-soft">
          No spend in this range.{" "}
          {range.includeReplay ? null : (
            <>
              Replay rows are hidden;{" "}
              <Link href={query(range.days, true)} className="underline underline-offset-4">
                show them
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <Section title="Daily" id="daily">
          <SpendStrip days={view.byDay} />
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Spend per day</caption>
              <thead>
                <tr>
                  <th scope="col" className={table.th}>
                    Day (UTC)
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Spend
                  </th>
                  <th scope="col" className={table.th}>
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...view.byDay].reverse().map((d) => (
                  <tr key={d.day}>
                    <td className={table.td}>{d.day}</td>
                    <td className={`${table.td} ${table.num}`}>{usd(d.usd)}</td>
                    <td className={table.td}>{d.anomaly ? "high" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="By task" id="tasks">
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Spend by AI task</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Task
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Calls
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Spend
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Per call
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Cache hit
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Repairs
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  p50 latency
                </th>
              </tr>
            </thead>
            <tbody>
              {view.byTask.map((t) => (
                <tr key={t.task}>
                  <td className={`${table.td} font-mono text-xs`}>{t.task}</td>
                  <td className={`${table.td} ${table.num}`}>{t.calls}</td>
                  <td className={`${table.td} ${table.num}`}>{usd(t.usd)}</td>
                  <td className={`${table.td} ${table.num}`}>
                    {usd(t.calls > 0 ? t.usd / t.calls : 0)}
                  </td>
                  <td className={`${table.td} ${table.num}`}>{percent(t.cacheHitRate)}</td>
                  <td className={`${table.td} ${table.num}`}>{percent(t.repairRate)}</td>
                  <td className={`${table.td} ${table.num}`}>
                    {(t.p50LatencyMs / 1000).toFixed(1)} s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="By model" id="models">
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Spend by model</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Model
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Calls
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Spend
                </th>
              </tr>
            </thead>
            <tbody>
              {view.byModel.map((m) => (
                <tr key={m.model}>
                  <td className={`${table.td} font-mono text-xs`}>{m.model}</td>
                  <td className={`${table.td} ${table.num}`}>{m.calls}</td>
                  <td className={`${table.td} ${table.num}`}>{usd(m.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Top kits" id="kits">
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Most expensive kits in the range</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  School
                </th>
                <th scope="col" className={table.th}>
                  Applicant
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Spend
                </th>
                <th scope="col" className={table.th}>
                  Cap
                </th>
              </tr>
            </thead>
            <tbody>
              {view.topKits.map((k) => (
                <tr key={k.kitId}>
                  <td className={table.td}>{k.school}</td>
                  <td className={table.td}>{k.userEmail ?? "(deleted)"}</td>
                  <td className={`${table.td} ${table.num}`}>{usd(k.usd)}</td>
                  <td className={table.td}>
                    {k.overHard ? "Over the hard cap" : k.overSoft ? "Over the soft cap" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Top users" id="users">
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Highest-spend users in the range</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  User
                </th>
                <th scope="col" className={table.th}>
                  Paid
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Spend
                </th>
              </tr>
            </thead>
            <tbody>
              {view.topUsers.map((u) => (
                <tr key={u.userId}>
                  <td className={table.td}>
                    <Link
                      href={`/admin/users/${u.userId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {u.email}
                    </Link>
                  </td>
                  <td className={table.td}>{u.paid ? "Paid" : "Free"}</td>
                  <td className={`${table.td} ${table.num}`}>{usd(u.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Voice" id="voice">
        <p className="tabular-nums text-text">
          {view.voice.sttMinutes.toFixed(0)} dictation minutes ·{" "}
          {view.voice.ttsChars.toLocaleString("en-GB")} characters read aloud ·{" "}
          {usd(view.voice.usd)}
        </p>
      </Section>
    </>
  );
}
