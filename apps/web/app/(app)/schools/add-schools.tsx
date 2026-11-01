"use client";

import {
  Button,
  TextField,
  citationKey,
  citationText,
  formatDay,
  formatVerifiedOn,
  type Citation,
} from "@admitstory/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type RefObject } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { SchoolCard } from "@/lib/strategy/types";

// "Add schools" (spec §5.5): search by name. Each published school shows its current cycle's rounds
// and deadlines in the applicant's time zone, its essays, interview format, verified AI policy and
// pack freshness, with the sources listed under it. A school without a published pack says "Pack
// coming soon" and offers "Ask us to cover {School}"; it can join the list but never be bought.

const SEARCH_DELAY_MS = 200;

export interface AddSchoolsProps {
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}

export function AddSchools({ inputRef, autoFocus = false }: AddSchoolsProps) {
  const router = useRouter();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [found, setResults] = useState<SchoolCard[] | null>(null);
  // An empty search shows no results, without an effect clearing them.
  const results = query.trim() === "" ? null : found;
  const [timeZone, setTimeZone] = useState("UTC");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (q === "") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/schools?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as { schools: SchoolCard[]; timeZone: string };
          setResults(body.schools);
          setTimeZone(body.timeZone);
          setError("");
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setError("Search didn't finish. Check your connection and type again.");
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function add(card: SchoolCard) {
    if (!card.cycleId) return;
    setBusy(card.schoolId);
    setError("");
    const response = await fetch("/api/user-schools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schoolCycleId: card.cycleId }),
    }).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      setError(`${card.shortName} wasn't added. Try adding it again.`);
      return;
    }
    setStatus(`Added ${card.shortName} to your list.`);
    setResults(
      (current) =>
        current?.map((c) => (c.schoolId === card.schoolId ? { ...c, userSchoolId: "added" } : c)) ??
        null,
    );
    router.refresh();
  }

  async function askToCover(card: SchoolCard) {
    setBusy(card.schoolId);
    const response = await fetch(`/api/schools/${card.schoolId}/interest`, {
      method: "POST",
    }).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      setError(`Your request for ${card.shortName} wasn't recorded. Ask again.`);
      return;
    }
    setStatus(`Asked us to cover ${card.shortName}.`);
    setResults(
      (current) =>
        current?.map((c) => (c.schoolId === card.schoolId ? { ...c, voted: true } : c)) ?? null,
    );
  }

  return (
    <section aria-labelledby="add-heading" className="flex flex-col gap-4">
      <h2 id="add-heading" className="text-lg font-semibold text-text">
        Add schools
      </h2>
      <TextField
        ref={inputRef}
        label="Search by school name"
        type="search"
        autoComplete="off"
        // The empty state hands focus here (direction doc, screen E).
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-controls={resultsId}
        className="max-w-xl"
      />
      <StatusMessage message={status} />
      <AlertMessage message={error} />
      <div id={resultsId}>
        {results === null ? null : results.length === 0 ? (
          <p className="text-text-soft">{`No school matches "${query.trim()}". Try its short name.`}</p>
        ) : (
          <ul className="flex flex-col">
            {results.map((card) => (
              <SchoolResult
                key={card.schoolId}
                card={card}
                timeZone={timeZone}
                busy={busy === card.schoolId}
                onAdd={() => void add(card)}
                onAsk={() => void askToCover(card)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SchoolResult({
  card,
  timeZone,
  busy,
  onAdd,
  onAsk,
}: {
  card: SchoolCard;
  timeZone: string;
  busy: boolean;
  onAdd: () => void;
  onAsk: () => void;
}) {
  const citations = new Map<string, Citation>();
  for (const c of [
    card.rounds[0]?.citation,
    card.essays?.citation,
    card.interview?.citation,
    card.aiPolicy?.citation,
  ])
    if (c) citations.set(citationKey(c), c);

  return (
    <li className="flex flex-col gap-3 border-b border-edge py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold text-text">
          {card.name}
          {card.cycle ? (
            <span className="font-normal text-text-soft">{` ${card.cycle}`}</span>
          ) : null}
        </p>
        {card.pack === "published" ? (
          <>
            <p className="text-sm text-verified">
              {card.verifiedOn ? `Verified ${formatVerifiedOn(card.verifiedOn)}` : null}
            </p>
            {card.rounds.length > 0 ? (
              <p className="text-sm text-text tabular-nums">
                {card.rounds
                  .map((r) => `${r.short} ${formatDay(r.deadline, timeZone)}`)
                  .join(" · ")}
              </p>
            ) : null}
            {card.essays ? (
              <p className="text-sm text-text">
                {`${card.essays.count} ${card.essays.count === 1 ? "essay" : "essays"}: ${card.essays.lengths.join(", ")}`}
              </p>
            ) : null}
            {card.interview ? (
              <p className="text-sm text-text">{`Interview: ${card.interview.text}`}</p>
            ) : null}
            {card.aiPolicy ? <p className="text-sm text-text">{card.aiPolicy.text}</p> : null}
            {citations.size > 0 ? (
              <p className="text-xs text-text-soft">
                {`Sources: ${[...citations.values()].map((c) => citationText(c)).join(" ")}`}
              </p>
            ) : null}
            <p className="text-xs text-text-soft">{`Deadlines shown in your time zone (${timeZone}).`}</p>
          </>
        ) : (
          <p className="text-sm text-text-soft">
            Pack coming soon. Its rounds and essays show once we&apos;ve verified them.
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {card.userSchoolId ? (
          <p className="text-sm text-text-soft">On your list</p>
        ) : card.cycleId ? (
          <Button size="sm" onClick={onAdd} loading={busy}>
            {busy ? "Adding" : `Add ${card.shortName}`}
          </Button>
        ) : null}
        {card.pack === "coming_soon" ? (
          card.voted ? (
            <p className="text-sm text-text-soft">{`You asked us to cover ${card.shortName}`}</p>
          ) : (
            <Button size="sm" variant="secondary" onClick={onAsk} disabled={busy}>
              {`Ask us to cover ${card.shortName}`}
            </Button>
          )
        ) : null}
      </div>
    </li>
  );
}
