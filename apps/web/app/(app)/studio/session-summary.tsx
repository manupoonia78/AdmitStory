"use client";

import { Button } from "@admitstory/ui";
import Link from "next/link";
import type { SummaryDto } from "./types";

// The end-of-session card (spec §5.2): what was found, what is still thin, and the one next step.
// The copy follows §6.9: plain, specific, no praise of the answers themselves.

export function SessionSummaryCard({
  summary,
  onContinue,
}: {
  summary: SummaryDto;
  onContinue: () => void;
}) {
  const stories = summary.storyCount;
  const facts = summary.factCount;
  const thin = summary.nextUp[0];

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-display-sm text-text">
          {stories === 0
            ? "Everything so far is saved."
            : `That's a strong start: ${stories} ${stories === 1 ? "story" : "stories"} and ${facts} ${facts === 1 ? "fact" : "facts"}.`}
        </h1>
        {thin ? (
          <p className="text-text-soft">
            We don&apos;t yet have {thin.what} — {Math.max(5, summary.nextUp.length * 3)} minutes
            next time?
          </p>
        ) : null}
      </div>

      {summary.thinLenses.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-text">Still thin</h2>
          <ul className="flex flex-col gap-1 text-text-soft">
            {summary.thinLenses.map((lens) => (
              <li key={lens.id}>{lens.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.conflictCount > 0 ? (
        <p className="text-text-soft">
          {summary.conflictCount === 1
            ? "One fact needs you to say which version is current."
            : `${summary.conflictCount} facts need you to say which version is current.`}{" "}
          <Link href="/dossier?tab=facts" className="underline underline-offset-2 hover:text-text">
            Resolve them
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {/* Profile Read is Phase 3; until then the Dossier is the honest next step. */}
        <Button asChild>
          <Link href="/dossier">See what we have</Link>
        </Button>
        <Button variant="quiet" onClick={onContinue}>
          Keep talking
        </Button>
      </div>
    </section>
  );
}
