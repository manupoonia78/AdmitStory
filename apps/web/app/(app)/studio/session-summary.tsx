"use client";

import { Button } from "@admitstory/ui";
import Link from "next/link";
import { STORIES_BEFORE_READ } from "@/lib/home/next-step";
import type { SummaryDto } from "./types";

// The end-of-session card (spec §5.2): what was found, what is still thin, and the one next step.
// The copy follows §6.9: plain, specific, no praise of the answers themselves.
//
// The next step is the one that shows the applicant what their stories are worth (16 Nov 2026;
// it used to be the Dossier, from before the Profile Read existed): their school's preview, which
// opens one of their own essays, then the Profile Read. The Dossier is the fallback only when
// there is no story yet to build either from.

interface Step {
  href: string;
  label: string;
}

/** What to offer after a session, most useful first. */
export function nextSteps(
  stories: number,
  school: { userSchoolId: string; name: string } | null,
): Step[] {
  const steps: Step[] = [];
  if (stories >= 1 && school)
    steps.push({
      href: `/schools/${school.userSchoolId}/preview`,
      label: `See your stories as a ${school.name} application`,
    });
  if (stories >= STORIES_BEFORE_READ)
    steps.push({ href: "/profile-read", label: "See how admissions will read you" });
  if (stories >= 1 && !school) steps.push({ href: "/schools", label: "Choose your schools" });
  if (steps.length === 0) steps.push({ href: "/dossier", label: "See what we have" });
  return steps;
}

export function SessionSummaryCard({
  summary,
  school,
  onContinue,
}: {
  summary: SummaryDto;
  /** The school the applicant would unlock next, when one is on their list. */
  school: { userSchoolId: string; name: string } | null;
  onContinue: () => void;
}) {
  const stories = summary.storyCount;
  const facts = summary.factCount;
  const thin = summary.nextUp[0];
  const [first, ...rest] = nextSteps(stories, school);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-display text-text">
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
          <h2 className="font-display text-[1.625rem] leading-tight tracking-[-0.01em] text-text">
            Still thin
          </h2>
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
        {first ? (
          <Button asChild>
            <Link href={first.href}>{first.label}</Link>
          </Button>
        ) : null}
        {rest.map((step) => (
          <Button key={step.href} asChild variant="secondary">
            <Link href={step.href}>{step.label}</Link>
          </Button>
        ))}
        <Button variant="quiet" onClick={onContinue}>
          Keep talking
        </Button>
      </div>
    </section>
  );
}
