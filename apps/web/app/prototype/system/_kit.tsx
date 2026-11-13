"use client";

// The component kit of /prototype/system: every control of the system once, rendered inside
// whichever material wraps it. The page mounts it three times (instrument, paper, night paper),
// so each instance keeps its own state and ids.

import {
  Button,
  EmptyState,
  FieldErrorRegion,
  FieldHint,
  IconButton,
  Label,
  SLIDING_PILL,
  StatusLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextField,
  TextLink,
  cx,
  useSlidingIndicator,
} from "@admitstory/ui";
import {
  ArrowCounterClockwiseIcon,
  KeyboardIcon,
  MicrophoneIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { useId, useRef, useState, type ReactNode } from "react";

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-edge pt-5">
      <p className="label">{name}</p>
      {children}
    </div>
  );
}

const ROUNDS = ["Round 1", "Round 2", "Round 3"] as const;
const MODES = [
  { id: "speak", label: "Speak", icon: MicrophoneIcon },
  { id: "write", label: "Write", icon: KeyboardIcon },
] as const;

/** Speak / Write: a pill of flat frost with one inner pill that slides (SPEC §2.9). */
function Segmented() {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("speak");
  const group = useRef<HTMLDivElement>(null);
  useSlidingIndicator(group, '[data-state="checked"]');
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label="How you answer"
      className={cx("group/seg inline-flex self-start rounded-full frost-flat p-1", SLIDING_PILL)}
    >
      {MODES.map((option) => {
        const checked = option.id === mode;
        const OptionIcon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={checked}
            data-state={checked ? "checked" : "unchecked"}
            tabIndex={checked ? 0 : -1}
            onClick={() => setMode(option.id)}
            onKeyDown={(event) => {
              if (!event.key.startsWith("Arrow")) return;
              event.preventDefault();
              setMode(option.id === "speak" ? "write" : "speak");
              const next = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                '[data-state="unchecked"]',
              );
              next?.focus();
            }}
            className={cx(
              "relative inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-text-soft shadow-none hover:text-text",
              "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2",
              "transition-colors duration-(--dur-hover) ease-rise",
              "data-[state=checked]:bg-frost-hover data-[state=checked]:text-text group-data-ind/seg:data-[state=checked]:bg-transparent",
            )}
          >
            <OptionIcon size={18} aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Kit() {
  const [round, setRound] = useState<string>("Round 2");
  const [reapplicant, setReapplicant] = useState(false);
  const notesId = useId();

  return (
    <div className="flex flex-col gap-8">
      <Row name="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" arrow>
            Start your story
          </Button>
          <Button size="lg" variant="secondary">
            See how it works
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button arrow>Continue</Button>
          <Button variant="secondary" icon={PlusIcon}>
            Add a school
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Save</Button>
          <Button size="sm" variant="secondary">
            Compare versions
          </Button>
          <Button size="sm" variant="quiet">
            Write instead
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="danger">
            Delete my story
          </Button>
          <Button size="sm" disabled>
            Unavailable
          </Button>
          <Button size="sm" variant="secondary" loading>
            Saving
          </Button>
          <IconButton
            icon={ArrowCounterClockwiseIcon}
            aria-label="Undo"
            variant="secondary"
            size="sm"
          />
        </div>
      </Row>

      <Row name="Fields">
        <TextField
          label="Where do you work now?"
          hint="The name on your offer letter, not the parent company."
          defaultValue="Harbourline Freight"
          autoComplete="off"
        />
        <TextField
          label="Years of full-time work"
          defaultValue="four-ish"
          error="Use a number, such as 4.5."
          autoComplete="off"
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={notesId}>Anything the essay must not leave out</Label>
          <FieldHint>Two or three lines are plenty.</FieldHint>
          <textarea
            id={notesId}
            rows={3}
            defaultValue="The forty minutes outside Nashik."
            className="min-h-30 w-full rounded-control border border-control bg-field px-4 py-3 text-[1rem] leading-6 text-text"
          />
          <FieldErrorRegion id={`${notesId}-error`} />
        </div>
      </Row>

      <Row name="Chips and the segmented control">
        <div className="flex flex-wrap gap-2">
          {ROUNDS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={round === option}
              onClick={() => setRound(option)}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            aria-pressed={reapplicant}
            onClick={() => setReapplicant((value) => !value)}
          >
            Reapplicant
          </button>
        </div>
        <Segmented />
      </Row>

      <Row name="Tabs">
        <Tabs defaultValue="essays">
          <TabsList aria-label="Northfield application">
            <TabsTrigger value="essays">Essays</TabsTrigger>
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="resume">Résumé</TabsTrigger>
          </TabsList>
          <TabsContent value="essays" className="text-sm text-text-soft">
            Three prompts, one drafted.
          </TabsContent>
          <TabsContent value="application" className="text-sm text-text-soft">
            Twelve short answers from the form.
          </TabsContent>
          <TabsContent value="video" className="text-sm text-text-soft">
            One question, sixty seconds, notes only.
          </TabsContent>
          <TabsContent value="resume" className="text-sm text-text-soft">
            One page, narrative first.
          </TabsContent>
        </Tabs>
      </Row>

      <Row name="Status, links, eyebrow">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <StatusLabel tone="verified">Confirmed</StatusLabel>
          <StatusLabel tone="needs">Needs you</StatusLabel>
          <StatusLabel tone="risk">Must fix</StatusLabel>
          <StatusLabel tone="neutral">Not started</StatusLabel>
        </div>
        <p className="eyebrow">How it works</p>
        <p className="text-sm text-text-soft">
          Prices are on the <TextLink href="/pricing">pricing page</TextLink>. All sales are final.
        </p>
      </Row>

      <Row name="Card and empty state">
        <a href="#components" className="card card-link flex flex-col gap-3 p-6">
          <span className="flex items-baseline justify-between gap-4">
            <span className="text-title">Northfield</span>
            <span className="meta">06 Jan 2027</span>
          </span>
          <span className="text-sm text-text-soft">
            Positioned around the night you ran the depot alone. Two essays to go.
          </span>
        </a>
        <EmptyState
          headingLevel={3}
          title="No recommenders yet"
          description="Add the person who saw your best work. We write their brief from your story."
          action={
            <Button size="sm" variant="secondary" icon={PlusIcon}>
              Add a recommender
            </Button>
          }
        />
      </Row>
    </div>
  );
}
