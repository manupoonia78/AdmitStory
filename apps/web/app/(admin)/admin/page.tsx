import {
  countNewFeedback,
  listAdminAlerts,
  listEvalRuns,
  listFeatureSwitches,
  spendSnapshot,
} from "@admitstory/db";
import { ALERT_LABELS, FEATURE_SWITCHES } from "@admitstory/shared";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { stamp, usd } from "@/lib/admin/costs";
import { ActionButton } from "./_components/action-button";
import { Section, table } from "./_components/fields";

export const metadata: Metadata = { title: "Overview" };

const SEVERITY = { critical: "risk", warn: "needs", info: "neutral" } as const;

/** Overview (spec §5.18): today's spend, open alerts, paused switches, new feedback, last eval. */
export default async function AdminOverview() {
  const admin = await requireAdminPage();
  const now = new Date();
  const [spend, alerts, switches, newFeedback, [lastRun]] = await Promise.all([
    spendSnapshot(admin, now),
    listAdminAlerts(admin, { open: true, limit: 50 }),
    listFeatureSwitches(admin.db),
    countNewFeedback(admin),
    listEvalRuns(admin, { limit: 1 }),
  ]);
  const paused = switches.filter((s) => !s.enabled);
  const ratio = spend.trailingDailyMeanUsd > 0 ? spend.todayUsd / spend.trailingDailyMeanUsd : null;

  return (
    <>
      <h1 className="text-display-sm text-text">Overview</h1>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 tabular-nums sm:grid-cols-4">
        <div>
          <dt className="text-sm text-text-soft">Spend today (live)</dt>
          <dd className="text-2xl font-semibold text-text">{usd(spend.todayUsd)}</dd>
          <dd className="text-sm text-text-soft">
            7-day mean {usd(spend.trailingDailyMeanUsd)}
            {ratio !== null && ratio > 1.5 ? " · running high" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-text-soft">Open alerts</dt>
          <dd className="text-2xl font-semibold text-text">{alerts.length}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-soft">Paused features</dt>
          <dd className="text-2xl font-semibold text-text">{paused.length}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-soft">New feedback</dt>
          <dd className="text-2xl font-semibold text-text">
            <Link href="/admin/feedback?status=new" className="underline-offset-4 hover:underline">
              {newFeedback}
            </Link>
          </dd>
        </div>
      </dl>

      <Section title="Open alerts" id="alerts">
        {alerts.length === 0 ? (
          <p className="text-text-soft">Nothing needs a look.</p>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Open alerts, newest first</caption>
              <thead>
                <tr>
                  <th scope="col" className={table.th}>
                    Alert
                  </th>
                  <th scope="col" className={table.th}>
                    Severity
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Seen
                  </th>
                  <th scope="col" className={table.th}>
                    Last
                  </th>
                  <th scope="col" className={table.th}>
                    Detail
                  </th>
                  <th scope="col" className={table.th}>
                    <span className="sr-only">Acknowledge</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className={table.td}>
                      {alert.title}
                      <span className="block text-xs text-text-soft">
                        {ALERT_LABELS[alert.kind] ?? alert.kind}
                      </span>
                    </td>
                    <td className={table.td}>
                      <StatusLabel tone={SEVERITY[alert.severity]}>{alert.severity}</StatusLabel>
                    </td>
                    <td className={`${table.td} ${table.num}`}>{alert.count}×</td>
                    <td className={table.td}>{stamp(alert.lastAt)}</td>
                    <td
                      className={`${table.td} max-w-md font-mono text-xs break-words text-text-soft`}
                    >
                      {Object.entries(alert.detail)
                        .slice(0, 6)
                        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                        .join(" · ")}
                    </td>
                    <td className={table.td}>
                      <ActionButton
                        action={`/api/admin/alerts/${alert.id}/acknowledge`}
                        label="Acknowledge"
                        done="Acknowledged"
                        variant="quiet"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Paused features"
        id="paused"
        aside={
          <Link href="/admin/switches" className="text-sm underline underline-offset-4">
            All switches
          </Link>
        }
      >
        {paused.length === 0 ? (
          <p className="text-text-soft">Every feature is on.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {paused.map((s) => (
              <li key={s.key} className="text-text">
                <StatusLabel tone="needs">Paused</StatusLabel>{" "}
                {FEATURE_SWITCHES[s.key]?.label ?? s.key}
                <span className="text-text-soft">
                  {" "}
                  · {s.reason ?? "no reason given"} · {stamp(s.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Last evaluation run"
        id="evals"
        aside={
          <Link href="/admin/evals" className="text-sm underline underline-offset-4">
            All runs
          </Link>
        }
      >
        {lastRun ? (
          <p className="text-text">
            <Link href={`/admin/evals/${lastRun.id}`} className="underline underline-offset-4">
              {lastRun.reason.replace(/_/g, " ")}, {lastRun.mode}
            </Link>{" "}
            <span className="text-text-soft">
              · {lastRun.status} · {stamp(lastRun.createdAt)} · {usd(lastRun.costUsd)}
            </span>
          </p>
        ) : (
          <p className="text-text-soft">
            No runs yet. Publishing canon or pressing “Run now” starts one.
          </p>
        )}
      </Section>
    </>
  );
}
