"use client";

import { Button, EmptyState, StatusLabel, cx } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { TRAITS, type LensId, type TraitId } from "@admitstory/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { StoryTimeline } from "./story-timeline";
import { STORY_STATUS_LABELS, type DossierPersonView, type DossierStoryView } from "./types";

// The Story Bank (spec §5.3b; SPEC §6.11). The hero is the timeline: the applicant's life as
// eras on one line, each chapter a card under its era. A list view is one click away, and it is
// the same data, not a lesser copy.

/** The open story's full card: long, and only one story is open at a time. */
const StoryDetail = dynamic(() => import("./story-detail").then((mod) => mod.StoryDetail), {
  loading: () => <div className="h-96 rounded-card border border-edge bg-depth" />,
});

const STATUS_TONES = {
  confirmed: "verified",
  partial: "needs",
  unconfirmed: "neutral",
} as const;

const CONTEXTS = ["professional", "academic", "community", "personal"] as const;
const LENSES: { id: LensId; label: string }[] = [
  { id: "academics", label: "Academics" },
  { id: "self_awareness", label: "Self-awareness" },
  { id: "employability", label: "Employability" },
  { id: "leadership", label: "Leadership" },
];

export function StoriesTab({
  stories,
  people,
}: {
  stories: DossierStoryView[];
  people: DossierPersonView[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [selectedId, setSelectedId] = useState<string | null>(stories[0]?.id ?? null);
  const [lens, setLens] = useState<LensId | "">("");
  const [trait, setTrait] = useState<TraitId | "">("");
  const [status, setStatus] = useState<DossierStoryView["status"] | "">("");
  const [context, setContext] = useState<DossierStoryView["context"] | "">("");
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(
    () =>
      stories.filter(
        (story) =>
          (lens === "" || story.lenses.includes(lens)) &&
          (trait === "" || story.traits.includes(trait)) &&
          (status === "" || story.status === status) &&
          (context === "" || story.context === context),
      ),
    [stories, lens, trait, status, context],
  );

  const selected = stories.find((story) => story.id === selectedId) ?? filtered[0] ?? null;

  const patch = (storyId: string, body: Record<string, unknown>, note: string) => {
    setError("");
    start(async () => {
      const response = await fetch(`/api/dossier/stories/${storyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "That change didn't save.");
        return;
      }
      setMessage(note);
      router.refresh();
    });
  };

  const merge = (keep: string, mergeId: string) => {
    setError("");
    start(async () => {
      const response = await fetch("/api/dossier/stories/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keep, merge: mergeId }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "Those stories didn't merge.");
        return;
      }
      setMergeFrom(null);
      setMessage("Stories merged.");
      router.refresh();
    });
  };

  if (stories.length === 0)
    return (
      <EmptyState
        title="No stories yet"
        description="Talk for five minutes and they'll start appearing here."
        action={
          <Button asChild>
            <Link href="/studio">Start talking</Link>
          </Button>
        }
      />
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div
          role="group"
          aria-label="View"
          data-view={view}
          className="seg relative inline-flex h-9 shrink-0 self-start rounded-full border border-edge bg-frost p-0.5"
        >
          {(["timeline", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className="relative z-10 h-full rounded-full px-4 text-sm font-medium text-text-soft transition-colors duration-200 select-none aria-pressed:text-text"
            >
              {option === "timeline" ? "Timeline" : "List"}
            </button>
          ))}
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Filter label="Lens" value={lens} onChange={(value) => setLens(value as LensId | "")}>
            <option value="">Any lens</option>
            {LENSES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Filter>
          <Filter label="Trait" value={trait} onChange={(value) => setTrait(value as TraitId | "")}>
            <option value="">Any trait</option>
            {TRAITS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Filter>
          <Filter
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as DossierStoryView["status"] | "")}
          >
            <option value="">Any status</option>
            {Object.entries(STORY_STATUS_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Filter>
          <Filter
            label="Context"
            value={context}
            onChange={(value) => setContext(value as DossierStoryView["context"] | "")}
          >
            <option value="">Anywhere</option>
            {CONTEXTS.map((entry) => (
              <option key={entry} value={entry}>
                {entry[0]?.toUpperCase()}
                {entry.slice(1)}
              </option>
            ))}
          </Filter>
        </div>
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="self-start lg:ms-auto lg:self-auto"
        >
          <Link href="/studio">Record a story</Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-soft">No stories match these filters.</p>
      ) : view === "timeline" ? (
        <StoryTimeline
          stories={filtered}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="label">
            {filtered.length} {filtered.length === 1 ? "story" : "stories"}
          </p>
          <ul className="flex flex-col border-t border-edge">
            {filtered.map((story) => (
              <li key={story.id} className="border-b border-edge">
                <button
                  type="button"
                  onClick={() => setSelectedId(story.id)}
                  aria-pressed={story.id === selected?.id}
                  className={cx(
                    "flex min-h-14 w-full flex-wrap items-center gap-x-4 gap-y-1 border-l-2 px-4 py-3 text-left transition-colors duration-200",
                    story.id === selected?.id
                      ? "border-l-text bg-veil"
                      : "border-l-transparent hover:bg-veil",
                  )}
                >
                  <span className="text-ui text-text">{story.nickname}</span>
                  <span className="label">
                    {story.context} {story.era}
                  </span>
                  <StatusLabel tone={STATUS_TONES[story.status]} className="ms-auto">
                    {STORY_STATUS_LABELS[story.status]}
                  </StatusLabel>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StatusMessage message={message} />
      <AlertMessage message={error} />

      {selected ? (
        <StoryDetail
          story={selected}
          people={people}
          others={stories.filter((story) => story.id !== selected.id)}
          pending={pending}
          mergeFrom={mergeFrom}
          onMergeFrom={setMergeFrom}
          onMerge={merge}
          onPatch={patch}
          onRefresh={() => router.refresh()}
          onError={setError}
          onMessage={setMessage}
        />
      ) : null}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  // A native select dressed as a 36 px pill (SPEC §6.11): the first option names the filter
  // ("Any lens"), and the label is its accessible name.
  return (
    <label className="relative inline-flex shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "dossier-filter h-9 appearance-none rounded-full border border-edge bg-frost ps-4 pe-9 text-sm font-medium transition-colors duration-200",
          value === "" ? "text-text-soft" : "border-text text-text",
        )}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute end-3.5 top-1/2 size-2 -translate-y-[70%] rotate-45 border-e-[1.25px] border-b-[1.25px] border-current text-text-soft"
      />
    </label>
  );
}
