"use client";

import {
  Button,
  FileMapList,
  KitPreviewError,
  PositioningBlock,
  UnlockCta,
  formatVerifiedOn,
} from "@admitstory/ui";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { PreviewState } from "@/lib/strategy/types";

// The free preview (spec §5.5; reshaped by Manu, 4 Nov 2026). The showcase around it is the
// server's: this screen owns only the applicant's own version. While it builds, the page holds the exact
// shape of the finished preview (no spinner, no shimmer) and asks the server where it stands every
// few seconds; the build itself runs in the background (kit-preview Inngest function), so leaving
// and coming back loses nothing.

const POLL_MS = 3_000;

export interface PreviewContextView {
  schoolId: string | null;
  schoolName: string;
  state: PreviewState;
}

function waiting(state: PreviewState): boolean {
  return state.state === "running" || (state.state === "ready" && state.updating);
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
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState("");
  const { schoolName, state } = view;

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

  async function start() {
    setAsking(true);
    setError("");
    const response = await fetch(`/api/user-schools/${userSchoolId}/preview`, {
      method: "POST",
    }).catch(() => null);
    setAsking(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `The ${schoolName} preview didn't start. Try again.`);
      return;
    }
    setView((await response.json()) as PreviewContextView);
  }

  async function askToCover() {
    if (!view.schoolId) return;
    const response = await fetch(`/api/schools/${view.schoolId}/interest`, {
      method: "POST",
    }).catch(() => null);
    if (response?.ok) setAsked(true);
    else setError(`Your request for ${schoolName} wasn't recorded. Ask again.`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-5 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-4 border-b border-edge pb-10">
        <Link
          href="/schools"
          className="self-start text-sm text-text-soft underline-offset-4 hover:underline"
        >
          Your schools
        </Link>
        <p className="eyebrow">Free preview</p>
        <h1 className="text-display text-text">
          Your <em>{schoolName}</em> pack
        </h1>
        <p className="max-w-essay text-lg text-text-soft">
          {`What ${schoolName} looks for, how we reshape a story for it, and everything the pack drafts. The drafts unlock when you buy the pack.`}
        </p>
      </header>
      <StatusMessage message={landed} />
      <AlertMessage message={error} />

      {state.state === "coming_soon" ? (
        <UnlockCta
          pack="coming_soon"
          schoolName={schoolName}
          asked={asked}
          {...(view.schoolId ? { onAskToCover: () => void askToCover() } : {})}
        />
      ) : (
        <>
          {setup}
          {intro}
          <section aria-labelledby="yours-heading" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="eyebrow">Your version</p>
              <h2
                id="yours-heading"
                className="font-display text-[1.75rem] leading-tight tracking-[-0.015em] text-text sm:text-[2rem]"
              >
                {`How you'd position for ${schoolName}`}
              </h2>
            </div>
            <YourVersion
              schoolName={schoolName}
              state={state}
              hasStories={hasStories}
              asking={asking}
              onStart={() => void start()}
            />
          </section>
          {details}
          {state.state === "ready" || state.state === "idle" || state.state === "running" ? (
            <div className="flex flex-col gap-4 rounded-plane border border-edge bg-depth p-6 sm:p-8">
              <p className="font-display text-[1.5rem] leading-tight text-text">
                {`Ready for the whole ${schoolName} file?`}
              </p>
              <UnlockCta
                pack="published"
                schoolName={schoolName}
                href={`/schools/${userSchoolId}/unlock`}
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
  onStart,
}: {
  schoolName: string;
  state: PreviewState;
  hasStories: boolean;
  asking: boolean;
  onStart: () => void;
}) {
  if (state.state === "idle")
    return hasStories ? (
      <div className="flex flex-col items-start gap-4">
        <p className="max-w-essay text-text">
          {`We read your stories against ${schoolName}'s pack and show which one leads, and where each goes. Free, once per school, and it carries over when you unlock.`}
        </p>
        <Button onClick={onStart} loading={asking}>
          {asking ? "Starting" : `Build my ${schoolName} preview`}
        </Button>
      </div>
    ) : (
      <div className="flex flex-col items-start gap-4 rounded-plane border border-dashed border-edge p-6">
        <p className="max-w-essay text-text">
          {`Tell us one story and we'll do for you what the example above shows: the narrative ${schoolName} should read, and which story goes where.`}
        </p>
        <Button asChild>
          <Link href="/studio">Tell your first story</Link>
        </Button>
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
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-text">Which of your stories goes where</h3>
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
        {`Choosing which of your stories goes where for ${schoolName}. This takes about a minute; you can leave and come back.`}
      </p>
      {["Your positioning", "Which of your stories goes where"].map((title, i) => (
        <section key={title} className="flex flex-col gap-3" aria-hidden="true">
          <p className="text-lg font-semibold text-text-soft">{title}</p>
          <div
            className="rounded-plane border border-edge bg-depth"
            style={{ height: i === 0 ? "7.5rem" : "11rem" }}
          />
        </section>
      ))}
    </div>
  );
}
