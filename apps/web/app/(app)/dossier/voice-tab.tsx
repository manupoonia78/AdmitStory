"use client";

import { Button, VoiceprintStill, cx } from "@admitstory/ui";
import { DEFAULT_IDENTITY } from "@admitstory/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import type { DossierGoalsView, DossierVoiceView } from "./types";

// Voice (spec §5.3d): what we learned about how this person writes and talks, plus their own tone
// control. The card is shown as it is — it is what the Writer will receive, and nothing about the
// applicant should be hidden from them.

const TONES = [
  { id: "plainspoken", label: "Plainspoken", detail: "Short, direct, nothing decorative." },
  { id: "conversational", label: "Conversational", detail: "How you'd explain it to a colleague." },
  { id: "storyteller", label: "Storyteller", detail: "Scenes and images, more room to breathe." },
] as const;

export function VoiceTab({
  voice,
  goals,
}: {
  voice: DossierVoiceView;
  goals: DossierGoalsView | null;
}) {
  const router = useRouter();
  const [tone, setTone] = useState(voice.tone);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const choose = async (next: string | null) => {
    setTone(next);
    setError("");
    const response = await fetch("/api/dossier/voice", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tone: next }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "That didn't save.");
      return;
    }
    setMessage(next === null ? "Back to matching how you talk." : "Tone saved.");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-6">
        <span aria-hidden>
          <VoiceprintStill identity={voice.identity ?? DEFAULT_IDENTITY} size={96} label="" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text">Your Voiceprint</h2>
          <p className="max-w-prose text-text-soft">
            {voice.identity === null
              ? "Drawn from a default for now. Once you've answered a few questions it becomes yours."
              : voice.identity.source === "text"
                ? "Drawn from the rhythm of your writing. It will be drawn from your voice once you speak."
                : "Drawn from the way you speak."}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">How you sound</h2>
        {voice.card ? (
          <p className="rounded-plane border border-edge bg-depth p-4 font-ui text-sm text-text">
            {voice.card}
          </p>
        ) : (
          <p className="text-text-soft">
            Not enough of your own words yet. Answer a few questions and this fills in.
          </p>
        )}
        {voice.stats ? (
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Stat label="Sentences" value={String(voice.stats.sentenceCount)} />
            <Stat label="Average length" value={`${voice.stats.sentenceLengthMean} words`} />
            <Stat
              label="Variety"
              value={
                voice.stats.sentenceLengthVariation >= 0.5
                  ? "high"
                  : voice.stats.sentenceLengthVariation >= 0.35
                    ? "moderate"
                    : "low"
              }
            />
          </dl>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Tone</h2>
        <p className="max-w-prose text-text-soft">
          By default your drafts match how you actually talk. You can lean one way instead.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {TONES.map((option) => {
            const selected = tone === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => void choose(option.id)}
                className={cx(
                  "flex flex-1 flex-col gap-1 rounded-plane border p-4 text-left",
                  selected ? "border-signal bg-veil" : "border-edge hover:bg-veil",
                )}
              >
                <span className="font-semibold text-text">{option.label}</span>
                <span className="text-sm text-text-soft">{option.detail}</span>
              </button>
            );
          })}
        </div>
        {tone !== null ? (
          <div>
            <Button variant="quiet" onClick={() => void choose(null)}>
              Match how I talk instead
            </Button>
          </div>
        ) : null}
      </section>

      {goals && (goals.shortTerm || goals.longTerm || goals.planB) ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-text">Your goals, as we have them</h2>
          <dl className="flex flex-col gap-3">
            {goals.shortTerm ? <Stat label="Short term" value={goals.shortTerm} stacked /> : null}
            {goals.longTerm ? <Stat label="Long term" value={goals.longTerm} stacked /> : null}
            {goals.planB ? <Stat label="Plan B" value={goals.planB} stacked /> : null}
          </dl>
        </section>
      ) : null}

      <StatusMessage message={message} />
      <AlertMessage message={error} />
    </div>
  );
}

function Stat({ label, value, stacked }: { label: string; value: string; stacked?: boolean }) {
  return (
    <div className={stacked ? "flex flex-col gap-0.5" : "flex flex-col"}>
      <dt className="text-sm font-medium text-text-soft">{label}</dt>
      <dd className={stacked ? "text-text" : "font-medium text-text"}>{value}</dd>
    </div>
  );
}
