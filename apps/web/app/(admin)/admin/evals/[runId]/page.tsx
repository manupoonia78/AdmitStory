import { loadBaseline } from "@admitstory/ai";
import { getEvalRun } from "@admitstory/db";
import type { EvalMetrics } from "@admitstory/shared";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { stamp, usd } from "@/lib/admin/costs";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminForm } from "../../_components/admin-form";
import { Field, Input, Section, table } from "../../_components/fields";
import { EVAL_STATUS } from "../../_components/status";

export const metadata: Metadata = { title: "Eval run" };

const ROWS: { key: keyof EvalMetrics; label: string; format: (v: number) => string }[] = [
  { key: "samples", label: "Samples", format: (v) => String(v) },
  { key: "inventedFacts", label: "Invented facts", format: (v) => String(v) },
  { key: "schemaFailures", label: "Schema failures", format: (v) => String(v) },
  { key: "mustFixRate", label: "Must-fix per judged sample", format: (v) => v.toFixed(2) },
  { key: "judgeMean", label: "Judge mean (1–5)", format: (v) => v.toFixed(2) },
  { key: "repairRate", label: "Repair rate", format: (v) => `${Math.round(v * 100)}%` },
  { key: "costUsdTotal", label: "Cost of the recorded calls", format: (v) => usd(v) },
];

/** One eval run: metrics against the baseline, gate failures, and its samples. */
export default async function EvalRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const admin = await requireAdminPage();
  const { runId } = await params;
  const found = await getEvalRun(admin, runId).catch(() => null);
  if (!found) notFound();
  const { run, samples } = found;
  const baseline = loadBaseline();
  const status = EVAL_STATUS[run.status] ?? { tone: "neutral" as const, label: run.status };
  const failed = samples.filter((s) => !s.passed);

  return (
    <>
      <h1 className="text-display-sm text-text">Eval run, {run.reason.replace(/_/g, " ")}</h1>
      <p className="flex flex-wrap items-center gap-3 text-text-soft">
        <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
        <span>{run.mode}</span>
        <span className="font-mono text-xs">{run.fingerprint}</span>
        <span>{stamp(run.createdAt)}</span>
      </p>
      {run.error ? <p className="text-risk">{run.error}</p> : null}
      {run.gate?.note ? (
        <p className="max-w-prose text-sm text-text-soft">{run.gate.note}</p>
      ) : null}

      {run.metrics ? (
        <Section title="Metrics" id="metrics">
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Metrics against the baseline</caption>
              <thead>
                <tr>
                  <th scope="col" className={table.th}>
                    Metric
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    This run
                  </th>
                  <th scope="col" className={`${table.th} ${table.num}`}>
                    Baseline
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(({ key, label, format }) => {
                  const value = run.metrics?.[key];
                  const before = baseline?.[key];
                  return (
                    <tr key={key}>
                      <td className={table.td}>{label}</td>
                      <td className={`${table.td} ${table.num}`}>
                        {typeof value === "number" ? format(value) : "None"}
                      </td>
                      <td className={`${table.td} ${table.num}`}>
                        {typeof before === "number" ? format(before) : "None"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section title="Gate" id="gate">
        {run.gate && run.gate.failures.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {run.gate.failures.map((f) => (
              <li key={f.metric} className="text-text">
                <StatusLabel tone="risk">{f.metric}</StatusLabel>{" "}
                <span className="text-text-soft">
                  {f.value} against {f.baseline ?? "no baseline"} ({f.rule})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-soft">No gate failures.</p>
        )}
        {run.approvedReason ? (
          <p className="text-text">Approved: {run.approvedReason}</p>
        ) : run.gate && run.gate.failures.length > 0 ? (
          <AdminForm
            action={`/api/admin/evals/${run.id}/approve`}
            submitLabel="Approve this run"
            done="Approved"
            className="flex max-w-md flex-col gap-2"
          >
            <Field
              label="Why it's acceptable"
              hint="For example, a deliberate move to a longer prompt."
            >
              <Input name="reason" required minLength={3} maxLength={300} />
            </Field>
          </AdminForm>
        ) : null}
      </Section>

      <Section title={`Samples (${samples.length}, ${failed.length} failed)`} id="samples">
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Samples, failures first</caption>
            <thead>
              <tr>
                <th scope="col" className={table.th}>
                  Task
                </th>
                <th scope="col" className={table.th}>
                  Fixture
                </th>
                <th scope="col" className={table.th}>
                  Result
                </th>
                <th scope="col" className={table.th}>
                  Invented
                </th>
                <th scope="col" className={`${table.th} ${table.num}`}>
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {[...failed, ...samples.filter((s) => s.passed)].map((s) => (
                <tr key={s.id}>
                  <td className={`${table.td} font-mono text-xs`}>{s.task}</td>
                  <td className={`${table.td} font-mono text-xs`}>{s.fixture}</td>
                  <td className={table.td}>
                    {s.passed ? (
                      <StatusLabel tone="verified">Passed</StatusLabel>
                    ) : (
                      <StatusLabel tone="risk">Failed</StatusLabel>
                    )}
                  </td>
                  <td className={`${table.td} text-xs`}>
                    {s.invented.map((i) => `“${i.text}”`).join("; ")}
                  </td>
                  <td className={`${table.td} ${table.num}`}>{usd(s.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
