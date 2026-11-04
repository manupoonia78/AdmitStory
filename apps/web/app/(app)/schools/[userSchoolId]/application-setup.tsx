"use client";

import { cx } from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { SchoolSetup } from "@/lib/strategy/setup";

// "Your application" (Manu, 4 Nov 2026): the round you plan for, whether you applied before and how
// far it got, as choices that save the moment you tap them. It replaces the form row at the bottom
// of the schools list ("I applied here before", a free-text outcome, Save) and sits on the school's
// own preview and unlock pages, where the answers change what the pack drafts.

const OUTCOMES = [
  "Not invited to interview",
  "Interviewed, not admitted",
  "Waitlisted, not admitted",
  "Admitted, didn't enrol",
] as const;

function Choice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-10 items-center rounded-full border px-4 text-sm tabular-nums transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        pressed
          ? "border-signal bg-signal text-on-signal"
          : "border-edge text-text hover:border-text-soft",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2.5 sm:flex-row sm:gap-6">
      <p className="meta pt-2.5 text-text-soft sm:w-36 sm:shrink-0">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function ApplicationSetup({ setup }: { setup: SchoolSetup }) {
  const router = useRouter();
  const { schoolName } = setup;
  const [round, setRound] = useState(setup.round);
  const [reapplicant, setReapplicant] = useState(setup.isReapplicant);
  const [outcome, setOutcome] = useState(setup.previousOutcome);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function save(body: Record<string, unknown>, done: string, undo: () => void) {
    setError("");
    const response = await fetch(`/api/user-schools/${setup.userSchoolId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!response?.ok) {
      undo();
      setError("That didn't save. Try again.");
      return;
    }
    setStatus(done);
    router.refresh();
  }

  async function remove() {
    setError("");
    const response = await fetch(`/api/user-schools/${setup.userSchoolId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `${schoolName} wasn't removed. Try again.`);
      setConfirming(false);
      return;
    }
    router.push("/schools");
  }

  function chooseRound(next: string | null) {
    if (next === round) return;
    const before = round;
    setRound(next);
    const label = setup.rounds.find((r) => r.value === next)?.label;
    void save({ round: next }, next ? `Planning for ${label ?? next}.` : "Round cleared.", () =>
      setRound(before),
    );
  }

  function chooseReapplicant(next: boolean) {
    if (next === reapplicant) return;
    setReapplicant(next);
    void save(
      next ? { isReapplicant: true } : { isReapplicant: false, previousOutcome: null },
      next
        ? `Marked as a reapplication. The pack adds what ${schoolName} asks reapplicants.`
        : "No longer marked as a reapplication.",
      () => setReapplicant(!next),
    );
    if (!next) setOutcome(null);
  }

  function chooseOutcome(next: string) {
    if (next === outcome) return;
    const before = outcome;
    setOutcome(next);
    void save({ previousOutcome: next }, "Saved what happened last time.", () =>
      setOutcome(before),
    );
  }

  // Past rounds stay out of the way unless one is the one chosen.
  const rounds = setup.rounds.filter((r) => !r.past || r.value === round);
  const outcomes: string[] = [...OUTCOMES];
  if (outcome && !outcomes.includes(outcome)) outcomes.unshift(outcome);

  return (
    <section
      aria-labelledby="setup-heading"
      className="flex flex-col gap-6 rounded-plane border border-edge bg-depth p-6 sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Your application</p>
        <h2
          id="setup-heading"
          className="font-display text-[1.5rem] leading-tight tracking-[-0.01em] text-text"
        >
          {`Two things that shape your ${schoolName} pack`}
        </h2>
      </div>

      <div className="flex flex-col gap-5">
        {rounds.length > 0 ? (
          <Row label="Round">
            <Choice pressed={round === null} onClick={() => chooseRound(null)}>
              Not decided
            </Choice>
            {rounds.map((r) => (
              <Choice
                key={r.value}
                pressed={round === r.value}
                onClick={() => chooseRound(r.value)}
              >
                {r.label}
              </Choice>
            ))}
          </Row>
        ) : null}

        <Row label="Applied before?">
          <Choice pressed={!reapplicant} onClick={() => chooseReapplicant(false)}>
            First time
          </Choice>
          <Choice pressed={reapplicant} onClick={() => chooseReapplicant(true)}>
            {`I applied to ${schoolName} before`}
          </Choice>
        </Row>

        {reapplicant ? (
          <Row label="Last time">
            {outcomes.map((o) => (
              <Choice key={o} pressed={outcome === o} onClick={() => chooseOutcome(o)}>
                {o}
              </Choice>
            ))}
          </Row>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-edge pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-text-soft" aria-hidden="true">
            {status || "Saved as you choose."}
          </p>
          <StatusMessage message={status} className="sr-only" />
          <AlertMessage message={error} />
        </div>
        {setup.removable ? (
          confirming ? (
            <span className="flex items-center gap-4 text-sm">
              <span className="text-text">{`Remove ${schoolName} from your list?`}</span>
              <button
                type="button"
                onClick={() => void remove()}
                className="font-medium text-text underline underline-offset-4"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-text-soft hover:text-text"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm text-text-soft underline-offset-4 hover:text-text hover:underline"
            >
              {`Remove ${schoolName}`}
            </button>
          )
        ) : null}
      </div>
    </section>
  );
}
