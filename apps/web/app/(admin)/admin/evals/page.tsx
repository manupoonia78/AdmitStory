import { listEvalRuns } from "@admitstory/db";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { stamp, usd } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { ActionButton } from "../_components/action-button";
import { table } from "../_components/fields";
import { EVAL_STATUS } from "../_components/status";

export const metadata: Metadata = { title: "Evals" };

/** Evals (spec §8.11): every run of the suite, newest first. */
export default async function EvalsPage() {
  const admin = await requireAdminPage();
  const runs = await listEvalRuns(admin, { limit: 100 });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display-sm text-text">Evals</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin/evals/review" className="text-sm underline underline-offset-4">
            This week&apos;s ratings
          </Link>
          <ActionButton
            action="/api/admin/evals/run"
            json={{ reason: "manual" }}
            label="Run now"
            done="Started"
            variant="primary"
          />
        </div>
      </div>
      <p className="max-w-prose text-text-soft">
        Runs here re-check every recorded reply against today&apos;s schemas and the invented-fact
        check, and compare cost and repairs with the baseline. They&apos;re advisory: the gate that
        blocks a change runs in CI (<code>eval:gate</code>) and nightly against the live models.
      </p>
      {runs.length === 0 ? (
        <p className="text-text-soft">No runs yet.</p>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Evaluation runs</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Started
                </th>
                <th scope="col" className={table.th}>
                  Why
                </th>
                <th scope="col" className={table.th}>
                  Mode
                </th>
                <th scope="col" className={table.th}>
                  Status
                </th>
                <th scope="col" className={table.th}>
                  Gate failures
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const status = EVAL_STATUS[run.status] ?? {
                  tone: "neutral" as const,
                  label: run.status,
                };
                return (
                  <tr key={run.id}>
                    <td className={table.td}>
                      <Link
                        href={`/admin/evals/${run.id}`}
                        className="underline underline-offset-4"
                      >
                        {stamp(run.createdAt)}
                      </Link>
                    </td>
                    <td className={table.td}>
                      {run.reason.replace(/_/g, " ")}
                      <span className="block font-mono text-xs text-text-soft">
                        {run.fingerprint}
                      </span>
                    </td>
                    <td className={table.td}>{run.mode}</td>
                    <td className={table.td}>
                      <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
                      {run.approvedReason ? (
                        <span className="block text-xs text-text-soft">
                          Approved: {run.approvedReason}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${table.td} text-xs`}>
                      {run.gate?.failures.map((f) => f.metric).join(", ") || "None"}
                    </td>
                    <td className={`${table.td} ${table.num}`}>{usd(run.costUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
