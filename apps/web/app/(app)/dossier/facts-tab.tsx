"use client";

import { Button, EmptyState, StatusLabel, TextField, cx } from "@admitstory/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { FACT_STATUS_LABELS, type DossierFactView } from "./types";

// The Fact Sheet (spec §5.3a): the single source of truth, as a clean dense table (§6.7). Two
// things matter most here — a conflict is one tap to resolve, and an approved phrasing is editable,
// because every essay, form entry and brief has to use it word for word (§8.8 `factMismatch`).

const TONES = {
  confirmed: "verified",
  needs_confirmation: "neutral",
  conflict: "needs",
} as const;

export function FactsTab({ facts }: { facts: DossierFactView[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const conflicts = facts.filter((fact) => fact.status === "conflict");
  const rest = facts.filter((fact) => fact.status !== "conflict");

  const call = async (url: string, body: unknown, note: string) => {
    setError("");
    const response = await fetch(url, {
      method: url.endsWith("/resolve") ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "That change didn't save.");
      return false;
    }
    setMessage(note);
    router.refresh();
    return true;
  };

  if (facts.length === 0)
    return (
      <EmptyState
        title="No facts yet"
        description="Upload a CV or answer a few questions, and the things we should never get wrong will collect here."
        action={
          <Button asChild>
            <Link href="/studio">Start talking</Link>
          </Button>
        }
      />
    );

  return (
    <div className="flex flex-col gap-6">
      {conflicts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-text">
            {conflicts.length === 1 ? "One fact needs you" : `${conflicts.length} facts need you`}
          </h2>
          <ul className="flex flex-col gap-3">
            {conflicts.map((fact) => (
              <li
                key={fact.id}
                className="flex flex-col gap-3 rounded-plane border border-needs/40 bg-needs/5 p-4"
              >
                <p className="text-text">
                  You said {quoted(fact.otherValue)} earlier and {quoted(fact.value)} today. Which
                  is current?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void call(
                        `/api/dossier/facts/${fact.id}/resolve`,
                        { choice: "current" },
                        "Fact confirmed.",
                      )
                    }
                  >
                    {fact.value}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void call(
                        `/api/dossier/facts/${fact.id}/resolve`,
                        { choice: "other" },
                        "Fact confirmed.",
                      )
                    }
                  >
                    {fact.otherValue}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <StatusMessage message={message} />
      <AlertMessage message={error} />

      <div className="overflow-x-auto rounded-plane border border-edge">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Your Fact Sheet: what we know, how it will be phrased, and whether it is confirmed.
          </caption>
          <thead>
            <tr className="border-b border-edge text-sm text-text-soft">
              <th scope="col" className="px-4 py-2 font-medium">
                Fact
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                What we&apos;ll write
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rest.map((fact) => (
              <tr key={fact.id} className="border-b border-edge last:border-0 align-top">
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block text-text">{humanKey(fact.key)}</span>
                  <span className="block text-sm text-text-soft">
                    {fact.code}
                    {fact.note ? ` · ${fact.note}` : ""}
                  </span>
                </th>
                <td className="px-4 py-3">
                  {editing === fact.id ? (
                    <FactEditor
                      fact={fact}
                      onCancel={() => setEditing(null)}
                      onSave={async (body) => {
                        const saved = await call(
                          `/api/dossier/facts/${fact.id}`,
                          body,
                          "Fact saved.",
                        );
                        if (saved) setEditing(null);
                      }}
                    />
                  ) : (
                    <>
                      <span className="text-text">{fact.approvedPhrasing ?? fact.value}</span>
                      {fact.approvedPhrasing ? (
                        <span className="block text-sm text-text-soft">
                          Underlying value: {fact.value}
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusLabel tone={TONES[fact.status]}>
                    {FACT_STATUS_LABELS[fact.status]}
                  </StatusLabel>
                  {!fact.consentToUse ? (
                    <span className="mt-1 block text-sm text-text-soft">Kept private</span>
                  ) : null}
                </td>
                <td className={cx("px-4 py-3 text-end")}>
                  {editing === fact.id ? null : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="quiet" onClick={() => setEditing(fact.id)}>
                        Edit
                      </Button>
                      {fact.status !== "confirmed" ? (
                        <Button
                          variant="quiet"
                          onClick={() =>
                            void call(
                              `/api/dossier/facts/${fact.id}`,
                              { status: "confirmed" },
                              "Fact confirmed.",
                            )
                          }
                        >
                          Confirm
                        </Button>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FactEditor({
  fact,
  onSave,
  onCancel,
}: {
  fact: DossierFactView;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(fact.value);
  const [phrasing, setPhrasing] = useState(fact.approvedPhrasing ?? "");
  const [consent, setConsent] = useState(fact.consentToUse);

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="The fact"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <TextField
        label="How it should be written"
        hint='Optional. For example "50+ hospitals" rather than "53".'
        value={phrasing}
        onChange={(event) => setPhrasing(event.target.value)}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm text-text-soft">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="size-5 accent-signal"
        />
        Use this fact in my applications
      </label>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            void onSave({
              value,
              approvedPhrasing: phrasing.trim() === "" ? null : phrasing.trim(),
              consentToUse: consent,
            })
          }
          disabled={value.trim() === ""}
        >
          Save fact
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** `team_size` → "Team size". The keys are ours; the label is the applicant's. */
function humanKey(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function quoted(value: string | null): string {
  return value === null ? "something else" : `“${value}”`;
}
