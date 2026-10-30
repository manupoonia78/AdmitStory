"use client";

import { Button, EmptyState, StatusLabel, cx, type ConstellationStory } from "@admitstory/ui";
import dynamic from "next/dynamic";
import { TRAITS, type LensId, type TraitId } from "@admitstory/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertMessage, StatusMessage } from "@/components/live-message";
import { STORY_STATUS_LABELS, type DossierPersonView, type DossierStoryView } from "./types";

// The Story Bank (spec §5.3b). The hero is the constellation (§6.7): stories as nodes by era,
// grouped by what they prove, with lines between stories that share a trait. A list view is one
// keystroke away, and the list is the same data — not a lesser copy.

// The constellation is a canvas view with its own drag, zoom and layout code, and it is only one of
// the two ways to read the Story Bank. It loads after mount so the list — which is the same data,
// server-rendered — is what the first paint pays for (spec §6.11's per-route JS budget).
/** The open story's full card: long, and only one story is open at a time. */
const StoryDetail = dynamic(() => import("./story-detail").then((mod) => mod.StoryDetail), {
  loading: () => <div className="h-96 rounded-plane border border-edge bg-depth" />,
});

const Constellation = dynamic(
  () => import("./constellation-view").then((mod) => mod.Constellation),
  {
    ssr: false,
    // The placeholder holds the exact height of what is coming, so nothing jumps (spec §6.1).
    loading: () => (
      <div className="h-[clamp(20rem,52vh,34rem)] rounded-plane border border-edge bg-depth" />
    ),
  },
);

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
  const [view, setView] = useState<"constellation" | "list">("constellation");
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

  const nodes: ConstellationStory[] = filtered.map((story) => ({
    id: story.id,
    code: story.code,
    nickname: story.nickname,
    era: story.era,
    lenses: story.lenses as LensId[],
    traits: story.traits,
    status: story.status,
    sensitivity: story.sensitivity,
  }));

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
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
        <Button asChild variant="secondary" className="ms-auto">
          <Link href="/studio">Record a story</Link>
        </Button>
      </div>

      {view === "constellation" ? (
        <Constellation
          stories={nodes}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onShowList={() => setView("list")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-soft">
              {filtered.length} {filtered.length === 1 ? "story" : "stories"}
            </p>
            <Button variant="quiet" onClick={() => setView("constellation")}>
              Constellation view
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-edge rounded-plane border border-edge">
            {filtered.map((story) => (
              <li key={story.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(story.id)}
                  aria-pressed={story.id === selected?.id}
                  className={cx(
                    "flex min-h-11 w-full flex-wrap items-center gap-3 px-4 py-3 text-left",
                    story.id === selected?.id ? "bg-veil" : "hover:bg-veil",
                  )}
                >
                  <span className="font-medium text-text">{story.nickname}</span>
                  <span className="text-sm text-text-soft">
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
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-control border border-control-edge bg-depth px-3 text-text"
      >
        {children}
      </select>
    </label>
  );
}
