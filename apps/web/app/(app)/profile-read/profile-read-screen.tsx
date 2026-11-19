"use client";

import {
  Button,
  EmptyState,
  EvidenceLink,
  FeedbackControl,
  LensFindings,
  LensTable,
  StrengtheningPlan,
  type EvidenceItem,
  type EvidenceRef,
  type Finding,
  type FindingAction,
  type LensFindingsData,
  type LensReading,
} from "@admitstory/ui";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";

// Screen D (spec §5.4, §6.10 D; docs/design/phase-3-4-direction.md D). The hero is the four-lens
// instrument; below it the four lens sections (helps, doubts, what to do), the strengthening plan
// and the brand preview. One evidence drawer serves the whole page. No scores and no odds (§14.5).

const POLL_MS = 4_000;

/** Loaded on the first evidence link; it is an overlay, so nothing holds its place. */
const EvidenceDrawer = dynamic(
  () => import("./evidence-drawer-view").then((mod) => mod.EvidenceDrawer),
  { ssr: false },
);

export interface ProfileReadScreenProps {
  readings: LensReading[];
  lenses: LensFindingsData[];
  plan: FindingAction[];
  brand: Finding[];
  evidence: Record<string, EvidenceItem>;
  version: number | null;
  /** The read on screen, rated by the feedback control at the foot. */
  readId: string | null;
  builtAt: string | null;
  behind: boolean;
  /** "thin": not enough stories yet. "building": the first read is on its way. */
  state: "ready" | "building" | "thin";
}

function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ProfileReadScreen({
  readings,
  lenses,
  plan,
  brand,
  evidence,
  version,
  readId,
  builtAt,
  behind,
  state,
}: ProfileReadScreenProps) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<{ items: EvidenceItem[]; claim?: string } | null>(null);
  // Mounted from the first open on, so later opens and every close keep their motion.
  const [drawerUsed, setDrawerUsed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [waitingFor, setWaitingFor] = useState<number | null>(state === "building" ? 0 : null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // While a build is on its way, refresh the server render until a newer version lands.
  const landed = waitingFor !== null && version !== null && version > waitingFor;
  const waiting = waitingFor !== null && !landed;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, router]);

  function open(refs: readonly EvidenceRef[], claim?: string) {
    const items = refs.flatMap((ref) => {
      const item = evidence[ref.id];
      return item ? [item] : [];
    });
    setDrawer({ items, ...(claim ? { claim } : {}) });
    setDrawerUsed(true);
  }

  async function rebuild() {
    setAsking(true);
    setError("");
    const response = await fetch("/api/profile/read/refresh", { method: "POST" }).catch(() => null);
    setAsking(false);
    if (response?.status === 429) {
      setError("You asked for a new read a moment ago. Try again in a few minutes.");
      return;
    }
    if (!response?.ok) {
      setError("Your Profile Read didn't start building. Check your connection and try again.");
      return;
    }
    setWaitingFor(version ?? 0);
    setStatus("Building your Profile Read. This takes under a minute.");
  }

  const storyIndex = new Map<string, EvidenceRef>();
  for (const item of Object.values(evidence))
    if (item.kind === "story") storyIndex.set(item.id, item);

  // The lead: the first thing the read says about the applicant, or the page's line while there
  // is no read yet. It sets word by word once per new read (profile-read.css, `.read-lead`).
  const lead = brand[0] ?? null;
  const leadWords = (lead?.text ?? "").split(/\s+/).filter(Boolean);
  // Marks the sheet as a new read before the browser paints, so the lead sets word by word only
  // the first time this version is seen in the session. An attribute on the element, not state,
  // so nothing re-renders; storage blocked means no animation, which is the safe default.
  const sheet = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!lead || version === null) return;
    const key = "admitstories.read-seen";
    try {
      if (window.sessionStorage.getItem(key) === String(version)) return;
      window.sessionStorage.setItem(key, String(version));
    } catch {
      return;
    }
    sheet.current?.setAttribute("data-fresh", "");
  }, [lead, version]);

  return (
    <div className="mx-auto flex w-full max-w-[70rem] flex-col px-5 pt-6 pb-10 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14">
      <header className="mx-auto flex w-full max-w-[48rem] flex-col">
        <p className="enter label">How a reader may see you</p>
        <h1 className="enter mt-3 text-display-2 text-text" style={{ "--i": 0.8 } as CSSProperties}>
          Profile <span className="serif-accent">Read.</span>
        </h1>
        <p
          className="enter mt-4 max-w-[60ch] text-lg text-text-soft"
          style={{ "--i": 1.45 } as CSSProperties}
        >
          How an admissions reader is likely to see you in the first few minutes.
        </p>
        {builtAt ? (
          <p className="enter label mt-4" style={{ "--i": 2 } as CSSProperties}>
            Built {dayMonth(builtAt)} from your dossier
          </p>
        ) : null}
        {behind && !waiting ? (
          <div className="mt-6 flex flex-col items-start gap-3 border-l-2 border-needs pl-4">
            <p className="text-ui font-normal text-text">
              Your dossier has changed since {builtAt ? dayMonth(builtAt) : "this read"}. The read
              updates on its own once a day.
            </p>
            <Button size="sm" variant="secondary" onClick={() => void rebuild()} disabled={asking}>
              Build my Profile Read again
            </Button>
          </div>
        ) : null}
        <StatusMessage message={landed ? "Your Profile Read is up to date." : status} />
        <AlertMessage message={error} />
      </header>

      <article
        ref={sheet}
        className="read-sheet mx-auto mt-10 flex w-full max-w-[48rem] flex-col gap-12"
      >
        {state === "thin" && !lead ? null : (
          <section aria-labelledby="read-lead-label" className="flex flex-col gap-3">
            <p id="read-lead-label" className="label">
              {lead ? "In a sentence" : "Profile Read"}
            </p>
            {lead ? (
              <p className="read-lead">
                {leadWords.map((word, index) => (
                  <span
                    key={`${index}-${word}`}
                    style={{ "--w": Math.min(index, 11) } as CSSProperties}
                  >
                    {word}{" "}
                  </span>
                ))}
                <EvidenceLink refs={lead.evidence} onOpen={(refs) => open(refs, lead.text)} />
              </p>
            ) : state === "building" ? (
              <div className="flex flex-col gap-5" aria-live="polite">
                <p className="read-lead text-text-soft">
                  Reading your stories against the four lenses. This takes under a minute.
                </p>
                <span aria-hidden className="read-waiting" />
              </div>
            ) : null}
          </section>
        )}

        <section aria-labelledby="read-lenses" className="flex flex-col gap-4">
          <h2 id="read-lenses" className="label">
            The four lenses
          </h2>
          <LensTable
            readings={readings}
            onOpenStory={(id) => {
              const ref = storyIndex.get(id);
              if (ref) open([ref]);
            }}
          />
        </section>

        {state === "thin" ? (
          <EmptyState
            title="No stories behind your lenses yet"
            description="Talk for five minutes in Story Studio and they'll fill in."
            action={
              <Button asChild>
                <Link href="/studio">Start talking</Link>
              </Button>
            }
          />
        ) : null}

        {lenses.map((lens) => (
          <LensFindings key={lens.lens} data={lens} onOpenEvidence={(refs) => open(refs)} />
        ))}

        {plan.length > 0 ? (
          <section
            className="flex flex-col gap-6 border-t border-edge pt-10"
            aria-labelledby="plan"
          >
            <h2 id="plan" className="font-ui text-display-3 text-text">
              What could still change before your deadlines
            </h2>
            <StrengtheningPlan items={plan} onOpenEvidence={(refs) => open(refs)} />
          </section>
        ) : null}

        {brand.length > 1 ? (
          <section
            className="flex flex-col gap-4 border-t border-edge pt-10"
            aria-labelledby="brand"
          >
            <h2 id="brand" className="label">
              What your stories say about you
            </h2>
            <ul className="flex flex-col gap-3 font-reading text-read">
              {brand.slice(1).map((item) => (
                <li key={item.id} className="text-text">
                  {item.text}{" "}
                  <EvidenceLink refs={item.evidence} onOpen={(refs) => open(refs, item.text)} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {readId && state === "ready" ? (
          <FeedbackControl
            targetType="profile_read"
            targetId={readId}
            className="border-t border-edge pt-8 font-ui"
          />
        ) : null}
      </article>

      {drawerUsed ? (
        <EvidenceDrawer
          open={drawer !== null}
          onOpenChange={(next) => {
            if (!next) setDrawer(null);
          }}
          items={drawer?.items ?? []}
          {...(drawer?.claim ? { description: drawer.claim } : {})}
        />
      ) : null}
    </div>
  );
}
