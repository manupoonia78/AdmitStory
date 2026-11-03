"use client";

// Screen H, the Stories tab: the stories one recommender saw for themselves. A count line with a
// tick per story, then the stories as rows — what they saw, what you did, the result with its
// numbers in tabular figures, and anything they said at the time in Newsreader, because those are
// their words. Each row edits in place; deleting one offers an undo.
//
// Quiet (§6.7): the hero is the Coverage tab, so nothing here animates on its own.

import type { LorStoryFields } from "@admitstory/shared/kit";
import { traitLabel } from "@admitstory/shared";
import { CheckIcon, QuestionIcon } from "@phosphor-icons/react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { storyCountHint, storyCountLine, storyTicks } from "./recommender-text";

export interface StoryRowItem extends LorStoryFields {
  id: string;
  code: string;
  origin: "extracted" | "edited" | "manual";
}

const FIELD =
  "min-h-11 w-full rounded-control border border-control bg-depth px-3 py-2 text-lg text-text placeholder:text-text-soft sm:text-base";

function Area({
  label,
  value,
  rows = 3,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-soft">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cx(FIELD, "resize-y")}
      />
    </div>
  );
}

const linesOf = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const commasOf = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * One story's fields, for editing a row in place or for writing a story by hand ("Add one
 * myself"), which the route opens in a sheet with an empty draft.
 */
export function StoryFieldsForm({
  story = {},
  firstName,
  saveLabel = "Save this story",
  onSave,
  onCancel,
}: {
  story?: Partial<LorStoryFields>;
  firstName: string;
  saveLabel?: string;
  onSave: (patch: LorStoryFields) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    title: story.title ?? "",
    what_happened: story.what_happened ?? "",
    what_they_saw: story.what_they_saw ?? "",
    your_actions: (story.your_actions ?? []).join("\n"),
    result: story.result ?? "",
    numbers: (story.numbers ?? []).join(", "),
    what_they_said: story.what_they_said ?? "",
  });
  const set = (key: keyof typeof draft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Area label="What you call it" value={draft.title} rows={1} onChange={set("title")} />
      <Area label="What happened" value={draft.what_happened} onChange={set("what_happened")} />
      <Area
        label={`What ${firstName} saw`}
        value={draft.what_they_saw}
        onChange={set("what_they_saw")}
        hint="The part only they can vouch for."
      />
      <Area
        label="What you did"
        value={draft.your_actions}
        onChange={set("your_actions")}
        hint="One action a line."
      />
      <Area label="How it turned out" value={draft.result} rows={2} onChange={set("result")} />
      <Area
        label="Numbers"
        value={draft.numbers}
        rows={1}
        onChange={set("numbers")}
        hint="Separated by commas, exactly as they are true."
      />
      <Area
        label={`What ${firstName} said at the time`}
        value={draft.what_they_said}
        rows={2}
        onChange={set("what_they_said")}
        hint="Only if you remember their words. Leave it empty otherwise."
      />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            onSave({
              title: draft.title.trim(),
              what_happened: draft.what_happened.trim(),
              what_they_saw: draft.what_they_saw.trim(),
              your_actions: linesOf(draft.your_actions),
              result: draft.result.trim(),
              numbers: commasOf(draft.numbers),
              what_they_said: draft.what_they_said.trim() || null,
              traits: story.traits ?? [],
              cites: story.cites ?? [],
            })
          }
          disabled={draft.title.trim() === "" || draft.what_they_saw.trim() === ""}
        >
          {saveLabel}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export interface StoriesPanelProps {
  firstName: string;
  stories: readonly StoryRowItem[];
  /** What the extraction couldn't find, as a question to the applicant. */
  missing: readonly { question_id: string; ask: string }[];
  /** Why stories can't be pulled out yet (no active kit), or null. */
  lockedReason: string | null;
  onSaveStory: (storyId: string, patch: Partial<LorStoryFields>) => void;
  onDeleteStory: (storyId: string) => void;
  /** "Tell Ravi's stories" and "Add one myself". */
  actions?: ReactNode;
  className?: string;
}

export function StoriesPanel({
  firstName,
  stories,
  missing,
  lockedReason,
  onSaveStory,
  onDeleteStory,
  actions,
  className,
}: StoriesPanelProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const hint = storyCountHint(stories.length, firstName);

  return (
    <div className={cx("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-3 text-text">
          <span className="tabular-nums">{storyCountLine(stories.length)}</span>
          <span aria-hidden className="flex items-center gap-1">
            {storyTicks(stories.length).map((filled, index) => (
              <span
                key={index}
                className={cx("h-1 w-5 rounded-full", filled ? "bg-signal" : "bg-edge")}
              />
            ))}
          </span>
        </p>
        {hint ? <p className="text-text-soft">{hint}</p> : null}
        {lockedReason ? <p className="text-text-soft">{lockedReason}</p> : null}
        {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
      </div>

      {missing.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {missing.map((item) => (
            <li
              key={item.question_id}
              className="inline-flex items-center gap-1 rounded-control border border-dashed border-needs px-2 py-1 text-sm text-needs"
            >
              <QuestionIcon size={16} aria-hidden className="shrink-0" />
              {item.ask}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="flex flex-col border-t border-edge">
        {stories.map((story) => (
          <li key={story.id} className="flex flex-col gap-2 border-b border-edge py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="flex items-center gap-2 font-medium text-text">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-voice" />
                {story.title}
              </h3>
              <span className="text-sm tabular-nums text-text-soft">{story.code}</span>
            </div>
            {editing === story.id ? (
              <StoryFieldsForm
                story={story}
                firstName={firstName}
                onSave={(patch) => {
                  onSaveStory(story.id, patch);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <p className="text-text-soft">
                  <span className="text-text">{firstName} saw: </span>
                  {story.what_they_saw}
                </p>
                {story.your_actions.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {story.your_actions.map((action) => (
                      <li key={action} className="flex gap-2 text-text">
                        <CheckIcon size={16} aria-hidden className="mt-1 shrink-0 text-verified" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {story.result ? <p className="tabular-nums text-text">{story.result}</p> : null}
                {story.what_they_said ? (
                  <blockquote className="font-reading text-read italic text-text">
                    &ldquo;{story.what_they_said}&rdquo;
                  </blockquote>
                ) : null}
                {story.traits.length > 0 ? (
                  <p className="text-sm text-text-soft">
                    {story.traits.map((trait) => traitLabel(trait)).join(" · ")}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(story.id)}>
                    Edit this story
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => onDeleteStory(story.id)}>
                    Delete this story
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
