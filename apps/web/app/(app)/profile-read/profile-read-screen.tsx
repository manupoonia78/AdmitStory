"use client";

import {
  Button,
  EvidenceLink,
  LensFindings,
  LensInstrument,
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
import { useEffect, useState } from "react";
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-display text-text sm:text-display-lg">Profile Read</h1>
        <p className="font-reading text-xl text-text-soft">
          How an admissions reader is likely to see you in the first few minutes.
        </p>
        {builtAt ? (
          <p className="text-sm text-text-soft">Built {dayMonth(builtAt)} from your dossier.</p>
        ) : null}
      </header>

      {behind && !waiting ? (
        <div className="flex flex-col items-start gap-3 border-l-2 border-edge pl-4">
          <p className="text-text">
            Your dossier has changed since {builtAt ? dayMonth(builtAt) : "this read"}. The read
            updates on its own once a day.
          </p>
          <Button variant="secondary" onClick={() => void rebuild()} disabled={asking}>
            Build my Profile Read again
          </Button>
        </div>
      ) : null}
      <StatusMessage message={landed ? "Your Profile Read is up to date." : status} />
      <AlertMessage message={error} />

      <section aria-label="Your four lenses">
        <LensInstrument
          readings={readings}
          label="Your four lenses, by the stories behind each"
          onOpenStory={(id) => {
            const ref = storyIndex.get(id);
            if (ref) open([ref]);
          }}
        />
      </section>

      {state === "thin" ? (
        <div className="flex flex-col items-start gap-4">
          <p className="max-w-prose text-lg text-text">
            No stories behind your lenses yet. Talk for five minutes in Story Studio and
            they&apos;ll fill in.
          </p>
          <Button asChild>
            <Link href="/studio">Start talking</Link>
          </Button>
        </div>
      ) : null}

      {state === "building" && lenses.length === 0 ? (
        <p className="text-text-soft" aria-live="polite">
          Reading your stories against the four lenses. This takes under a minute.
        </p>
      ) : null}

      {lenses.map((lens) => (
        <LensFindings key={lens.lens} data={lens} onOpenEvidence={(refs) => open(refs)} />
      ))}

      {plan.length > 0 ? (
        <section className="flex flex-col gap-6 border-t border-edge pt-6" aria-labelledby="plan">
          <h2 id="plan" className="text-display-sm text-text">
            What could still change before your deadlines
          </h2>
          <StrengtheningPlan items={plan} onOpenEvidence={(refs) => open(refs)} />
        </section>
      ) : null}

      {brand.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-edge pt-6" aria-labelledby="brand">
          <h2 id="brand" className="text-display-sm text-text">
            What your stories say about you
          </h2>
          <ul className="flex flex-col gap-3">
            {brand.map((item) => (
              <li key={item.id} className="text-text">
                {item.text}{" "}
                <EvidenceLink refs={item.evidence} onOpen={(refs) => open(refs, item.text)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
