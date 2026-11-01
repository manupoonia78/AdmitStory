"use client";

import { Button, FieldError } from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { adminRequest } from "./request";
import { EMPTY_ROUND, toEditable, toStored, type EditableRound, type StoredRound } from "./rounds";

// The rounds and deadlines table of one cycle (spec §5.18 "rounds, deadlines"). Each deadline has a
// date, a time and the school's time zone, since a deadline is a moment in the school's zone.

const control =
  "min-h-9 w-full rounded-control border border-control bg-depth px-2 text-sm text-text";

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Singapore",
    ];
  }
}

export function RoundsEditor({
  cycleId,
  label,
  rounds,
}: {
  cycleId: string;
  label: string;
  rounds: StoredRound[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRound[]>(() => rounds.map(toEditable));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const zoneList = useMemo(() => zones(), []);

  const update = (index: number, patch: Partial<EditableRound>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  async function save() {
    setError(null);
    setStatus(null);
    const result = await adminRequest(`/api/admin/cycles/${cycleId}`, {
      method: "PATCH",
      json: { rounds: rows.map(toStored) },
    });
    if (!result.ok) {
      const detail = result.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      setError(detail ? `${result.error} ${detail}` : result.error);
      return;
    }
    setStatus("Rounds saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="sr-only">Rounds for {label}</caption>
          <thead>
            <tr className="text-left text-text-soft">
              {[
                "Round",
                "Deadline",
                "Time",
                "Time zone",
                "Decision",
                "Interview invites",
                "Notes",
                "",
              ].map((heading) => (
                <th
                  key={heading || "actions"}
                  scope="col"
                  className="border-b border-edge px-1 py-1 font-medium"
                >
                  {heading || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="border-b border-edge p-1">
                  <input
                    aria-label={`Round ${index + 1} name`}
                    className={control}
                    value={row.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    placeholder="R1"
                  />
                </td>
                <td className="border-b border-edge p-1">
                  <input
                    type="date"
                    aria-label={`Round ${index + 1} deadline`}
                    className={control}
                    value={row.deadline}
                    onChange={(e) => update(index, { deadline: e.target.value })}
                  />
                </td>
                <td className="border-b border-edge p-1">
                  <input
                    type="time"
                    aria-label={`Round ${index + 1} deadline time`}
                    className={control}
                    value={row.time}
                    onChange={(e) => update(index, { time: e.target.value })}
                  />
                </td>
                <td className="border-b border-edge p-1">
                  <select
                    aria-label={`Round ${index + 1} time zone`}
                    className={control}
                    value={row.timeZone}
                    onChange={(e) => update(index, { timeZone: e.target.value })}
                  >
                    <option value="">Not given</option>
                    {zoneList.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-edge p-1">
                  <input
                    type="date"
                    aria-label={`Round ${index + 1} decision date`}
                    className={control}
                    value={row.decisionDate}
                    onChange={(e) => update(index, { decisionDate: e.target.value })}
                  />
                </td>
                <td className="border-b border-edge p-1">
                  <input
                    aria-label={`Round ${index + 1} interview invites window`}
                    className={control}
                    value={row.interviewInvitesWindow}
                    onChange={(e) => update(index, { interviewInvitesWindow: e.target.value })}
                  />
                </td>
                <td className="border-b border-edge p-1">
                  <input
                    aria-label={`Round ${index + 1} notes`}
                    className={control}
                    value={row.notes}
                    onChange={(e) => update(index, { notes: e.target.value })}
                  />
                </td>
                <td className="border-b border-edge p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="quiet"
                    onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
                  >
                    Remove {row.name || `round ${index + 1}`}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((row) => row.time && !row.timeZone) ? (
        <p className="text-sm text-needs">
          A deadline time needs its time zone, or it isn&apos;t saved.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setRows((r) => [...r, { ...EMPTY_ROUND }])}
        >
          Add a round
        </Button>
        <Button type="button" size="sm" onClick={save}>
          Save rounds
        </Button>
        <p aria-live="polite" className="text-sm text-text-soft">
          {status}
        </p>
      </div>
      <div aria-live="assertive">{error ? <FieldError>{error}</FieldError> : null}</div>
    </div>
  );
}
