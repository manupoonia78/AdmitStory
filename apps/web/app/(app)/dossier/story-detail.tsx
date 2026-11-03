"use client";

// The open story's card (spec §5.3b): every field, the golden lines, the people and their naming
// choice, the missing detail, and the consent switch. Split out of the Stories tab because it is
// the long half of it and only one story is ever open (spec §6.11's JS budget).

import { Button, StatusLabel, TextField } from "@admitstory/ui";
import { TRAITS, traitLabel, type TraitId } from "@admitstory/shared";
import dynamic from "next/dynamic";
import { useState } from "react";
import { appendAnswer } from "../studio/voice-flow";
import { STORY_STATUS_LABELS, type DossierPersonView, type DossierStoryView } from "./types";

/** Dictation for the missing detail: voice code, loaded only once a story that needs it is open. */
const DetailDictation = dynamic(
  () => import("./detail-dictation").then((mod) => mod.DetailDictation),
  { ssr: false, loading: () => <div className="size-20" /> },
);

const STATUS_TONES = {
  confirmed: "verified",
  partial: "needs",
  unconfirmed: "neutral",
} as const;

export function StoryDetail({
  story,
  people,
  others,
  pending,
  mergeFrom,
  onMergeFrom,
  onMerge,
  onPatch,
  onRefresh,
  onError,
  onMessage,
}: {
  story: DossierStoryView;
  people: DossierPersonView[];
  others: DossierStoryView[];
  pending: boolean;
  mergeFrom: string | null;
  onMergeFrom: (id: string | null) => void;
  onMerge: (keep: string, merge: string) => void;
  onPatch: (id: string, body: Record<string, unknown>, note: string) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [nickname, setNickname] = useState(story.nickname);
  const [detail, setDetail] = useState("");
  // Seconds and language of whatever part of the detail was dictated (metered like the Studio).
  const [dictated, setDictated] = useState<{ seconds: number; language: string | null } | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const cast = people.filter((person) => story.peopleCodes.includes(person.code));

  const addDetail = async () => {
    if (detail.trim() === "") return;
    setSending(true);
    try {
      const response = await fetch(`/api/dossier/stories/${story.id}/add-detail`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: detail,
          ...(dictated
            ? {
                inputMode: "voice",
                voiceSeconds: dictated.seconds,
                ...(dictated.language ? { language: dictated.language } : {}),
              }
            : {}),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        onError(result.error ?? "That detail didn't save.");
        return;
      }
      setDetail("");
      setDictated(null);
      onMessage("Detail added. It'll show up here in a moment.");
      onRefresh();
    } finally {
      setSending(false);
    }
  };

  const star = async (lineId: string, starred: boolean) => {
    const response = await fetch(`/api/dossier/lines/${lineId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    if (response.ok) onRefresh();
  };

  const setMayName = async (personId: string, mayName: boolean) => {
    const response = await fetch(`/api/dossier/people/${personId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mayName }),
    });
    if (response.ok) onRefresh();
  };

  return (
    <article className="flex flex-col gap-6 rounded-plane border border-edge bg-depth p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-2">
          <TextField
            label="Nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            onBlur={() => {
              if (nickname.trim() !== "" && nickname !== story.nickname)
                onPatch(story.id, { nickname: nickname.trim() }, "Nickname saved.");
            }}
          />
          <p className="text-sm text-text-soft">
            {story.code} · {story.context} {story.era}
          </p>
        </div>
        <StatusLabel tone={STATUS_TONES[story.status]}>
          {STORY_STATUS_LABELS[story.status]}
        </StatusLabel>
      </header>

      <dl className="flex flex-col gap-4">
        <Part label="Situation and stakes">
          {[story.situation, story.stakes].filter(Boolean).join(" ") || "Not yet."}
        </Part>
        <Part label="What I did">
          {story.actions.length > 0 ? (
            <ol className="list-decimal ps-5">
              {story.actions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ol>
          ) : (
            "Not yet."
          )}
        </Part>
        <Part label="Result">
          {story.result ?? "Not yet."}
          {story.numbers.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-2">
              {story.numbers.map((number) => (
                <li
                  key={`${number.label}-${number.value}`}
                  className="rounded-control border border-edge px-2 py-0.5 text-sm"
                >
                  {number.label}: <span className="font-medium">{number.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Part>
        <Part label="Reflection">{story.reflection ?? "Not yet."}</Part>
      </dl>

      {story.lines.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">Golden lines</h3>
          <p className="text-sm text-text-soft">
            Your own words, kept exactly. Star the ones you want in your drafts.
          </p>
          <ul className="flex flex-col gap-2">
            {story.lines.map((line) => (
              <li key={line.id} className="flex items-start gap-3">
                <button
                  type="button"
                  aria-pressed={line.starred}
                  onClick={() => void star(line.id, !line.starred)}
                  className="min-h-11 rounded-control px-2 text-sm text-text-soft hover:bg-veil hover:text-text"
                >
                  {line.starred ? "★ Starred" : "☆ Star"}
                </button>
                <q className="font-reading text-reading text-text">{line.text}</q>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cast.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">People</h3>
          <ul className="flex flex-col gap-2">
            {cast.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-3">
                <span className="text-text">
                  {person.name} <span className="text-text-soft">— {person.roleInLife}</span>
                </span>
                <label className="flex min-h-11 items-center gap-2 text-sm text-text-soft">
                  <input
                    type="checkbox"
                    checked={person.mayName}
                    onChange={(event) => void setMayName(person.id, event.target.checked)}
                    className="size-5 accent-signal"
                  />
                  I&apos;m happy to name them in essays
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {story.missing.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-control border border-needs/40 bg-needs/5 p-4">
          <h3 className="text-sm font-semibold text-text">Missing</h3>
          {story.missing.map((item, index) => (
            <p key={index} className="text-text">
              {item.question}
              {item.approxWords ? (
                <span className="text-text-soft"> About {item.approxWords} words.</span>
              ) : null}
            </p>
          ))}
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start">
            <label className="flex flex-1 flex-col gap-2 text-sm">
              <span className="sr-only">Your answer</span>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                rows={3}
                className="w-full rounded-control border border-control-edge bg-depth p-3 font-reading text-reading text-text"
              />
            </label>
            <DetailDictation
              disabled={sending}
              onDictated={(answer) => {
                if (!answer.text.trim()) return;
                setDetail((current) => appendAnswer(current, answer.text));
                setDictated((current) => ({
                  seconds: (current?.seconds ?? 0) + answer.seconds,
                  language: answer.language ?? current?.language ?? null,
                }));
              }}
            />
          </div>
          <div>
            <Button onClick={() => void addDetail()} disabled={sending || detail.trim() === ""}>
              Add this detail
            </Button>
          </div>
        </section>
      ) : null}

      {story.traits.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Shows</h3>
          {story.traits.map((trait) => (
            <span key={trait} className="rounded-control border border-edge px-2 py-0.5 text-sm">
              {TRAITS.some((entry) => entry.id === trait) ? traitLabel(trait as TraitId) : trait}
            </span>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-edge pt-4">
        <h3 className="text-sm font-semibold text-text">This story</h3>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={story.consentToUse}
            onChange={(event) =>
              onPatch(
                story.id,
                { consentToUse: event.target.checked },
                event.target.checked ? "This story can be used." : "This story is kept private.",
              )
            }
            className="mt-0.5 size-5 accent-signal"
          />
          <span>
            Use this story in my applications.
            {story.sensitivity === "sensitive" ? (
              <span className="block text-text-soft">
                You told us something personal here, so it stays out of every draft until you turn
                this on.
              </span>
            ) : null}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          {story.status !== "confirmed" ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => onPatch(story.id, { status: "confirmed" }, "Marked confirmed.")}
            >
              Mark confirmed
            </Button>
          ) : null}
          {mergeFrom === story.id ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Merge which story into this one?</span>
              <select
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) onMerge(story.id, event.target.value);
                }}
                className="min-h-11 rounded-control border border-control-edge bg-depth px-3"
              >
                <option value="">Choose a story</option>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.nickname}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Button
              variant="quiet"
              onClick={() => onMergeFrom(story.id)}
              disabled={others.length === 0}
            >
              Merge another story in
            </Button>
          )}
        </div>
      </section>
    </article>
  );
}

function Part({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm font-semibold text-text">{label}</dt>
      <dd className="font-reading text-reading text-text-soft">{children}</dd>
    </div>
  );
}
