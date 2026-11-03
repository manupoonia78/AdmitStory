"use client";

import { Button, KitPreview, KitPreviewError, UnlockCta, formatVerifiedOn } from "@admitstory/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { PreviewState } from "@/lib/strategy/types";

// The kit preview (spec §5.5, direction doc screen E). While it builds, the page holds the exact
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
}: {
  userSchoolId: string;
  initial: PreviewContextView;
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <Link href="/schools" className="text-sm text-text-soft underline-offset-2 hover:underline">
          School Strategy
        </Link>
        <h1 className="text-display-sm text-text">{`${schoolName} kit preview`}</h1>
        <p className="max-w-essay text-text-soft">
          How you&apos;d position for {schoolName}, which story goes where, and what the kit drafts.
          The drafts themselves stay locked until you unlock the kit.
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
      ) : null}

      {state.state === "idle" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-essay text-text">
            The preview reads your whole Dossier against {schoolName}&apos;s published pack.
            It&apos;s free, once per school, and it carries over if you unlock the kit.
          </p>
          <Button onClick={() => void start()} loading={asking}>
            {asking ? "Starting" : `Preview ${schoolName} kit`}
          </Button>
        </div>
      ) : null}

      {state.state === "running" ? <PreviewShape schoolName={schoolName} /> : null}

      {state.state === "failed" ? (
        <KitPreviewError schoolName={schoolName} onRetry={() => void start()} />
      ) : null}

      {state.state === "budget" ? (
        <div className="flex max-w-essay flex-col items-start gap-3">
          <p className="text-text">
            Your free allowance for previews is used up, so the {schoolName} preview can&apos;t be
            built. Previews you already have stay on their pages, and your Dossier is unchanged.
          </p>
          <Button asChild variant="secondary">
            <Link href="/schools">Back to School Strategy</Link>
          </Button>
        </div>
      ) : null}

      {state.state === "ready" ? (
        <div className="flex flex-col gap-6">
          {state.stale ? (
            <div className="flex flex-col items-start gap-3 border-l-2 border-needs pl-4">
              <p className="text-text">
                {state.updating
                  ? "Updating this preview with your latest Dossier."
                  : `Built on ${formatVerifiedOn(state.preview.builtAt)}. Your Dossier has changed since.`}
              </p>
              {state.updating ? null : (
                <Button size="sm" variant="secondary" onClick={() => void start()} loading={asking}>
                  {asking ? "Starting" : `Update ${schoolName} preview`}
                </Button>
              )}
            </div>
          ) : null}
          <KitPreview
            schoolName={schoolName}
            pack="published"
            headingLevel={2}
            positioning={{ headline: state.preview.headline, support: state.preview.support }}
            fileMap={state.preview.fileMap}
            deliverables={state.preview.deliverables}
            cta={{ href: `/schools/${userSchoolId}/unlock` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The finished preview's shape while it builds: the three sections in place, their text not yet
 * there. Planes in --depth with an --edge rule, no shimmer (spec §6.1).
 */
function PreviewShape({ schoolName }: { schoolName: string }) {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <p role="status" className="text-text">
        {`Choosing which of your stories goes where for ${schoolName}. This takes about a minute; you can leave and come back.`}
      </p>
      {["How you'd position", "Which story goes where", "What the kit drafts"].map((title, i) => (
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
