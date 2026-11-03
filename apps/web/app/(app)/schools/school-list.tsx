"use client";

import { Button } from "@admitstory/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { StrategyRow } from "@/lib/strategy/types";

// The applicant's list (spec §5.5, §11 PATCH /user-schools/:id): the round they plan to apply in,
// whether they applied before (it turns on the reapplicant questions in Story Studio and the
// Strategist's reapplicant angle), and each school's "Preview kit". A school without a published
// pack can't be previewed or bought, so it says "Pack coming soon" instead.

const control =
  "min-h-11 rounded-control border border-control bg-depth px-3 text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

export function SchoolList({ rows }: { rows: readonly StrategyRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function patch(row: StrategyRow, body: Record<string, unknown>, done: string) {
    setError("");
    const response = await fetch(`/api/user-schools/${row.userSchoolId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!response?.ok) {
      setError(`${row.shortName} wasn't updated. Try again.`);
      return;
    }
    setStatus(done);
    router.refresh();
  }

  async function remove(row: StrategyRow) {
    setError("");
    const response = await fetch(`/api/user-schools/${row.userSchoolId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `${row.shortName} wasn't removed. Try again.`);
      return;
    }
    setStatus(`Removed ${row.shortName} from your list.`);
    router.refresh();
  }

  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="list-heading" className="flex flex-col gap-4">
      <h2 id="list-heading" className="text-lg font-semibold text-text">
        Your list
      </h2>
      <StatusMessage message={status} />
      <AlertMessage message={error} />
      <ul className="flex flex-col">
        {rows.map((row) => (
          <SchoolRow
            key={row.userSchoolId}
            row={row}
            onPatch={(body, done) => void patch(row, body, done)}
            onRemove={() => void remove(row)}
          />
        ))}
      </ul>
    </section>
  );
}

function SchoolRow({
  row,
  onPatch,
  onRemove,
}: {
  row: StrategyRow;
  onPatch: (body: Record<string, unknown>, done: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [outcome, setOutcome] = useState(row.previousOutcome ?? "");
  const locked = row.status !== "considering" && row.status !== "preview";

  return (
    <li className="flex flex-col gap-4 border-b border-edge py-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold text-text">
          {row.name} <span className="font-normal text-text-soft">{row.cycle}</span>
        </p>
        <p className="text-sm text-text-soft">{row.verified ?? "Pack coming soon"}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {row.roundOptions.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-round`} className="text-sm font-medium text-text">
              Round
            </label>
            <select
              id={`${id}-round`}
              className={control}
              value={row.round ?? ""}
              onChange={(event) =>
                onPatch(
                  { round: event.target.value || null },
                  event.target.value
                    ? `${row.shortName}: planning for ${event.target.selectedOptions[0]?.text ?? event.target.value}.`
                    : `${row.shortName}: round cleared.`,
                )
              }
            >
              <option value="">Not decided</option>
              {row.roundOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex min-h-11 items-center gap-2">
          <input
            id={`${id}-reapp`}
            type="checkbox"
            checked={row.isReapplicant}
            onChange={(event) =>
              onPatch(
                { isReapplicant: event.target.checked },
                event.target.checked
                  ? `${row.shortName}: marked as a school you applied to before.`
                  : `${row.shortName}: no longer marked as a reapplication.`,
              )
            }
            className="size-5 accent-signal"
          />
          <label htmlFor={`${id}-reapp`} className="text-sm text-text">
            I applied here before
          </label>
        </div>

        {row.isReapplicant ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onPatch(
                { previousOutcome: outcome.trim() || null },
                `${row.shortName}: previous outcome saved.`,
              );
            }}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-outcome`} className="text-sm font-medium text-text">
                What happened last time
              </label>
              <input
                id={`${id}-outcome`}
                className={control}
                maxLength={200}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="Interviewed, then denied"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Save outcome
            </Button>
          </form>
        ) : null}

        {row.pack === "published" ? (
          <Button asChild size="sm">
            <Link
              href={`/schools/${row.userSchoolId}/preview`}
            >{`Preview ${row.shortName} kit`}</Link>
          </Button>
        ) : (
          <p className="min-h-11 content-center text-sm text-text-soft">Pack coming soon</p>
        )}
        {locked ? null : (
          <Button size="sm" variant="quiet" onClick={onRemove}>
            {`Remove ${row.shortName}`}
          </Button>
        )}
      </div>
    </li>
  );
}
