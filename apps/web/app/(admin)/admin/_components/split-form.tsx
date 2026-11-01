"use client";

import { Button, FieldError } from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminRequest } from "./request";

// The A/B split for one agent (spec §5.18): weights across up to five versions, summing to 100.
// A version left at 0 is deactivated.

export function SplitForm({
  agent,
  versions,
}: {
  agent: string;
  versions: { id: string; version: string; weight: number }[];
}) {
  const router = useRouter();
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(versions.map((v) => [v.id, v.weight])),
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const total = Object.values(weights).reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0);

  async function save() {
    setError(null);
    setStatus(null);
    const split = Object.entries(weights)
      .filter(([, weight]) => weight > 0)
      .map(([promptVersionId, weight]) => ({ promptVersionId, weight }));
    const result = await adminRequest("/api/admin/prompts/split", { json: { agent, split } });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus("Split saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4">
        {versions.map((v) => (
          <label key={v.id} className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">{v.version} share (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={weights[v.id] ?? 0}
              onChange={(e) => setWeights((w) => ({ ...w, [v.id]: Number(e.target.value) }))}
              className="min-h-9 w-24 rounded-control border border-control bg-depth px-2 text-base tabular-nums text-text"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={total !== 100}>
          Save the split
        </Button>
        <p className="text-sm tabular-nums text-text-soft" aria-live="polite">
          {total === 100 ? (status ?? "Adds up to 100") : `Adds up to ${total}; it must be 100`}
        </p>
      </div>
      <div aria-live="assertive">{error ? <FieldError>{error}</FieldError> : null}</div>
    </div>
  );
}
