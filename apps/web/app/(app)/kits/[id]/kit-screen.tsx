"use client";

import type { VoiceprintIdentity } from "@admitstory/shared";
import {
  Button,
  GapQuestionsPlane,
  KitAssembly,
  TextField,
  type KitDeliverable,
  type KitStage,
} from "@admitstory/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { KitView } from "@/lib/kit/view";

// Screen F (spec §5.7, §6.7, §6.10 F; direction doc F). The Voiceprint on the left, the
// deliverables on the right, threads from stories to deliverables as the file map lands, and first
// lines arriving as drafts finish. Done stages offer "Read it now" so reading starts early.

const READABLE = new Set(["positioning", "file_map", "drafts", "short_form", "checks", "verify"]);

function stagesOf(view: KitView): KitStage[] {
  return view.stages
    .filter((s) => s.key !== "forms")
    .map((s) => ({
      id: s.key,
      label: s.label,
      status:
        s.status === "done" || s.status === "skipped"
          ? "done"
          : s.status === "running"
            ? "active"
            : "waiting",
      ...(s.status === "done" && READABLE.has(s.key) ? { actionLabel: "Read it now" } : {}),
    }));
}

function deliverablesOf(view: KitView): KitDeliverable[] {
  const failed = new Set(view.failed.map((f) => f.id));
  return view.deliverables.map((d) => ({
    key: d.id,
    title: d.title,
    prompt: d.prompt,
    limit: d.limit,
    status: failed.has(d.id)
      ? "failed"
      : d.status === "drafting"
        ? "drafting"
        : d.status === "pending"
          ? d.story
            ? "mapped"
            : "waiting"
          : "ready",
    storyId: d.story,
    text: d.firstLine ?? "",
  }));
}

export function KitScreen({
  initial,
  identity,
}: {
  initial: KitView;
  identity: VoiceprintIdentity;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [gapMode, setGapMode] = useState<"choices" | "typing" | "skipped" | "done">("choices");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (view.status === "ready" || view.status === "failed") return;
    const source = new EventSource(`/api/kits/${view.id}/events`);
    source.addEventListener("kit", (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as KitView;
      setView(next);
      if (next.status === "ready") setStatus(`Your ${next.school} kit is ready.`);
    });
    return () => source.close();
    // One stream per kit; it closes itself once the kit settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id, view.status === "ready" || view.status === "failed"]);

  const stories = useMemo(
    () => view.stories.map((s) => ({ id: s.code, title: s.title })),
    [view.stories],
  );
  const firstDeliverable = view.deliverables.find((d) => d.status !== "pending");
  const starting = view.status === "pending" && view.stages.every((s) => s.status === "pending");
  const gapStage = view.stages.find((s) => s.key === "gaps");
  const gapCount = gapStage?.status === "done" ? view.gaps.length : null;

  function read() {
    if (firstDeliverable) router.push(`/workspace/${firstDeliverable.id}`);
  }

  async function retry(deliverableId: string) {
    setError("");
    const response = await fetch(`/api/kits/${view.id}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ only: [deliverableId] }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("That didn't start. Check your connection and try again.");
      return;
    }
    setView((v) => ({
      ...v,
      status: "pending",
      failed: v.failed.filter((f) => f.id !== deliverableId),
    }));
  }

  async function skip() {
    setGapMode("skipped");
    await fetch(`/api/kits/${view.id}/gaps/skip`, { method: "POST" }).catch(() => null);
  }

  async function submitAnswers(event: FormEvent) {
    event.preventDefault();
    setError("");
    for (const gap of view.gaps) {
      const text = answers[gap.id]?.trim();
      if (!text) continue;
      const response = await fetch(`/api/kits/${view.id}/gaps/${gap.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, via: "text" }),
      }).catch(() => null);
      if (!response?.ok) {
        setError("An answer didn't save. Check your connection and try again.");
        return;
      }
    }
    setGapMode("done");
  }

  const aside = (
    <GapQuestionsPlane
      count={gapCount}
      onTypeAnswers={() => setGapMode("typing")}
      onSkip={() => void skip()}
    >
      {gapMode === "typing" ? (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submitAnswers(e)}>
          {view.gaps.map((gap) => (
            <TextField
              key={gap.id}
              label={gap.question}
              hint={
                gap.approxWords
                  ? `About ${gap.approxWords} words · ${gap.deliverable}`
                  : gap.deliverable
              }
              value={answers[gap.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [gap.id]: e.target.value }))}
            />
          ))}
          <div className="flex gap-3">
            <Button type="submit">Save answers</Button>
            <Button type="button" variant="quiet" onClick={() => void skip()}>
              Skip, draft with gaps
            </Button>
          </div>
        </form>
      ) : gapMode === "done" ? (
        <p className="text-text">Thanks. Your answers go into the drafts.</p>
      ) : gapMode === "skipped" ? (
        <p className="text-text">Drafting now. The questions wait in the drafts as NEED chips.</p>
      ) : undefined}
    </GapQuestionsPlane>
  );

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-4 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-display text-text sm:text-display-lg">
          {starting
            ? "Payment confirmed, starting your kit"
            : view.status === "ready"
              ? `Your ${view.school} kit`
              : `Building your ${view.school} kit`}
        </h1>
        {view.error ? <p className="text-text">{view.error} Your other essays are ready.</p> : null}
        {view.status === "ready" && firstDeliverable ? (
          <div>
            <Button asChild>
              <Link href={`/workspace/${firstDeliverable.id}`}>Open the workspace</Link>
            </Button>
          </div>
        ) : null}
      </header>
      <StatusMessage message={status} />
      <AlertMessage message={error} />
      <KitAssembly
        identity={identity}
        stories={stories}
        deliverables={deliverablesOf(view)}
        stages={stagesOf(view)}
        deliverablesHeading={`What ${view.school} asks for`}
        onStageAction={read}
        onRetry={(key) => void retry(key)}
        aside={aside}
      />
    </div>
  );
}
