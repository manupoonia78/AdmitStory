"use client";

import {
  Button,
  buttonStyles,
  FileMapList,
  KitPreviewError,
  PositioningBlock,
  UnlockCta,
  formatVerifiedOn,
} from "@admitstory/ui";
import { CaretLeftIcon, LockSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { FEATURED_PLAN, SCHOOL_KIT_PRICE_CENTS, SCHOOL_PLANS, dollars } from "@/lib/payments/plans";
import type { PreviewOpeningView, PreviewState } from "@/lib/strategy/types";

// The free preview (spec §5.5; reshaped by Manu, 4 Nov 2026). The showcase around it is the
// server's: this screen owns only the applicant's own version. While it builds, the page holds the exact
// shape of the finished preview (no spinner, no shimmer) and asks the server where it stands every
// few seconds; the build itself runs in the background (kit-preview Inngest function), so leaving
// and coming back loses nothing.
//
// What sells the pack is the applicant's own story (Manu, 16 Nov 2026): once they have told one,
// the preview builds itself on arrival, their version moves above the worked example, and it
// carries the opening of one of their essays on a sheet, with the rest of that essay locked.

const POLL_MS = 3_000;

export interface PreviewContextView {
  schoolId: string | null;
  schoolName: string;
  state: PreviewState;
}

function waiting(state: PreviewState): boolean {
  return state.state === "running" || (state.state === "ready" && state.updating);
}

const PACK = SCHOOL_PLANS[FEATURED_PLAN];

/** What the unlock page will offer, said before the click so its prices are no surprise. */
function priceNote(schoolName: string): string {
  return `${dollars(SCHOOL_KIT_PRICE_CENTS)} for ${schoolName} alone, or ${PACK.schools} schools for ${dollars(PACK.priceCents)}. One payment, no subscription. Your preview carries over.`;
}

export function PreviewScreen({
  userSchoolId,
  initial,
  hasStories,
  setup,
  intro,
  details,
}: {
  userSchoolId: string;
  initial: PreviewContextView;
  hasStories: boolean;
  /** The round and reapplicant choices, rendered on the server. */
  setup: ReactNode;
  /** What the school looks for and the worked example, rendered on the server. */
  intro: ReactNode;
  /** What the pack drafts and the pointers, rendered on the server. */
  details: ReactNode;
}) {
  const [view, setView] = useState(initial);
  // With a story told and no preview yet, the preview starts by itself: nobody should have to ask
  // to see their own essay opening.
  const autoStart = initial.state.state === "idle" && hasStories;
  const autoStarted = useRef(false);
  const [asking, setAsking] = useState(autoStart);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState("");
  const { schoolName, state } = view;
  const unlockHref = `/schools/${userSchoolId}/unlock`;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/user-schools/${userSchoolId}/preview`).catch(() => null);
    if (response?.ok) setView((await response.json()) as PreviewContextView);
  }, [userSchoolId]);

  useEffect(() => {
    if (!waiting(state)) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [state, refresh]);

  // Announce the moment the preview lands: the live region reads it once, when it appears.
  const landed =
    state.state === "ready" && !state.updating ? `${schoolName} preview is ready.` : "";

  const request = useCallback(async () => {
    const response = await fetch(`/api/user-schools/${userSchoolId}/preview`, {
      method: "POST",
    }).catch(() => null);
    setAsking(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `The ${initial.schoolName} preview didn't start. Try again.`);
      return;
    }
    setView((await response.json()) as PreviewContextView);
  }, [userSchoolId, initial.schoolName]);

  function start() {
    setAsking(true);
    setError("");
    void request();
  }

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void request();
  }, [autoStart, request]);

  async function askToCover() {
    if (!view.schoolId) return;
    const response = await fetch(`/api/schools/${view.schoolId}/interest`, {
      method: "POST",
    }).catch(() => null);
    if (response?.ok) setAsked(true);
    else setError(`Your request for ${schoolName} wasn't recorded. Ask again.`);
  }

  // Their own version leads as soon as they have told a story (it is there, or on its way);
  // before that the worked example shows what they are about to get.
  const mine = hasStories || state.state === "ready" || state.state === "running";
  const yours = (
    <section aria-labelledby="yours-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="label">Your version</p>
        <h2 id="yours-heading" className="text-display-3 text-text">
          {`How you'd position for ${schoolName}`}
        </h2>
      </div>
      <YourVersion
        schoolName={schoolName}
        state={state}
        hasStories={hasStories}
        asking={asking}
        unlockHref={unlockHref}
        onStart={start}
      />
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-[4.5rem] px-5 pt-6 pb-24 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <header className="flex flex-col">
        <Link
          href="/schools"
          className="label -ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-full pr-2 pl-1 transition-colors duration-(--dur-hover) hover:text-text"
        >
          <CaretLeftIcon size={12} weight="bold" aria-hidden />
          Schools
        </Link>
        <p className="eyebrow mt-4">Free preview</p>
        <h1 className="mt-3 text-display-2 text-text">
          Your <span className="serif-accent text-text-soft">{schoolName}</span> pack
        </h1>
        <p className="mt-4 max-w-[60ch] text-lg text-text-soft">
          {mine
            ? `How your stories fit ${schoolName}, the opening of your first essay, and everything the pack drafts. The full drafts unlock when you buy the pack.`
            : `What ${schoolName} looks for, how we reshape a story for it, and everything the pack drafts. The drafts unlock when you buy the pack.`}
        </p>
        <StatusMessage message={landed} className="not-empty:mt-4" />
        <AlertMessage message={error} className="not-empty:mt-4" />
      </header>

      {state.state === "coming_soon" ? (
        <UnlockCta
          pack="coming_soon"
          schoolName={schoolName}
          asked={asked}
          {...(view.schoolId ? { onAskToCover: () => void askToCover() } : {})}
        />
      ) : (
        <>
          {mine ? yours : null}
          {setup}
          {intro}
          {mine ? null : yours}
          {details}
          {state.state === "ready" || state.state === "idle" || state.state === "running" ? (
            <div className="card flex flex-col gap-5 p-7 sm:p-9">
              <p className="text-display-3 text-text">
                {`Ready for the whole ${schoolName} file?`}
              </p>
              <UnlockCta
                pack="published"
                schoolName={schoolName}
                href={unlockHref}
                note={priceNote(schoolName)}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The applicant's own positioning: built from their stories, or how to get there. */
function YourVersion({
  schoolName,
  state,
  hasStories,
  asking,
  unlockHref,
  onStart,
}: {
  schoolName: string;
  state: PreviewState;
  hasStories: boolean;
  asking: boolean;
  unlockHref: string;
  onStart: () => void;
}) {
  if (state.state === "idle")
    return hasStories ? (
      <div className="flex flex-col items-start gap-4">
        <p className="max-w-essay text-text">
          {`We read your stories against ${schoolName}'s pack, show which one leads and where each goes, and draft the opening of your first essay. Free, once per school, and it carries over when you unlock.`}
        </p>
        <Button onClick={onStart} loading={asking}>
          {asking ? "Starting" : `Build my ${schoolName} preview`}
        </Button>
      </div>
    ) : (
      <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-edge p-6">
        <p className="max-w-essay text-text">
          {`Tell us one story and we'll do for you what the example above shows: the narrative ${schoolName} should read, and which story goes where.`}
        </p>
        <Link href="/studio" className={buttonStyles({ arrow: true })}>
          Tell your first story
          <span aria-hidden className="btn-arrow" />
        </Link>
      </div>
    );

  if (state.state === "running") return <PreviewShape schoolName={schoolName} />;

  if (state.state === "failed")
    return <KitPreviewError schoolName={schoolName} onRetry={onStart} />;

  if (state.state === "budget")
    return (
      <p className="max-w-essay text-text">
        {`Your free allowance for previews is used up, so your own ${schoolName} preview can't be built. Previews you already have stay on their pages, and your Dossier is unchanged.`}
      </p>
    );

  if (state.state !== "ready") return null;
  return (
    <div className="flex flex-col gap-6">
      {state.stale ? (
        <div className="flex flex-col items-start gap-3 border-l-2 border-needs pl-4">
          <p className="text-text">
            {state.updating
              ? "Updating this preview with your latest Dossier."
              : `Built on ${formatVerifiedOn(state.preview.builtAt)}. Your Dossier has changed since.`}
          </p>
          {state.updating ? null : (
            <Button size="sm" variant="secondary" onClick={onStart} loading={asking}>
              {asking ? "Starting" : `Update ${schoolName} preview`}
            </Button>
          )}
        </div>
      ) : null}
      <PositioningBlock headline={state.preview.headline} support={state.preview.support} />
      {state.preview.opening ? (
        <OpeningSheet
          opening={state.preview.opening}
          schoolName={schoolName}
          others={Math.max(0, state.preview.deliverables.length - 1)}
          unlockHref={unlockHref}
        />
      ) : state.preview.coached ? (
        <p className="max-w-essay border-l-2 border-edge pl-4 text-text-soft">
          {`${schoolName}'s AI policy doesn't allow drafted prose, so nothing is drafted here and its pack coaches instead: the beats for each essay, your own lines that fit them, and the questions to answer in your own writing.`}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <h3 className="text-title text-text">Which of your stories goes where</h3>
        <FileMapList entries={state.preview.fileMap} />
      </div>
    </div>
  );
}

/**
 * The finished preview's shape while it builds: both parts in place, their text not yet
 * there. Planes in --depth with an --edge rule, no shimmer (spec §6.1).
 */
function PreviewShape({ schoolName }: { schoolName: string }) {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <p role="status" className="text-text">
        {`Reading your stories against ${schoolName}'s pack and drafting the opening of your first essay. This takes about a minute; you can leave and come back.`}
      </p>
      {[
        ["Your positioning", "7.5rem"],
        ["The opening of your first essay", "14rem"],
        ["Which of your stories goes where", "11rem"],
      ].map(([title, height]) => (
        <section key={title} className="flex flex-col gap-3" aria-hidden="true">
          <p className="text-title text-text-soft">{title}</p>
          <div className="card" style={{ height }} />
        </section>
      ))}
    </div>
  );
}

/**
 * The opening of one of the applicant's own essays, on paper, with the rest of it locked: the
 * closest a free account gets to holding the finished thing. The rules under the text are drawn,
 * not text, so nothing locked can be read or copied.
 */
function OpeningSheet({
  opening,
  schoolName,
  others,
  unlockHref,
}: {
  opening: PreviewOpeningView;
  schoolName: string;
  others: number;
  unlockHref: string;
}) {
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-col gap-1.5">
        <h3 className="text-title text-text">
          {`The opening of your ${schoolName} ${opening.essay}`}
        </h3>
        <p className="max-w-[60ch] text-sm text-text-soft">{opening.prompt}</p>
      </figcaption>
      <div className="sheet flex max-w-[46rem] flex-col gap-5">
        <p className="meta flex flex-wrap gap-x-3 gap-y-1 text-current opacity-70">
          <span>{opening.limit ? `${opening.essay} · ${opening.limit}` : opening.essay}</span>
          <span>{`From your story “${opening.story}”`}</span>
        </p>
        <blockquote className="whitespace-pre-line">{opening.text}</blockquote>
        <div
          aria-hidden="true"
          className="flex flex-col gap-3.5 pt-1 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        >
          {[100, 97, 91, 99, 68].map((width, index) => (
            <span
              key={index}
              className="h-px bg-current opacity-30"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
        <p className="meta flex items-center gap-2 text-current opacity-80">
          <LockSimpleIcon size={14} aria-hidden />
          {others > 0
            ? `The rest of this essay and ${others} more ${others === 1 ? "draft" : "drafts"} are written when you unlock.`
            : "The rest of this essay is written when you unlock."}
        </p>
      </div>
      <p className="max-w-essay text-sm text-text-soft">
        Drafted from your own story, in your words where you said them. Every detail in the full
        draft comes with a Verify list, so nothing goes out that you haven&apos;t checked.
      </p>
      <UnlockCta
        pack="published"
        schoolName={schoolName}
        href={unlockHref}
        note={priceNote(schoolName)}
      />
    </figure>
  );
}
