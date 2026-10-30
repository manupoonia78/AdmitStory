"use client";

import {
  Button,
  StatusLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextField,
} from "@admitstory/ui";
import { CheckIcon } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import type { PreparedRevision } from "./essay";

// The Coach plane (spec §5.8, screen G): five tabs, quiet and typographic. Only Refine does
// anything in the prototype: each quick action returns a prepared change for the DiffMorph.

export type CoachTab = "why" | "options" | "refine" | "checks" | "verify";

export interface CoachPaneProps {
  tab: CoachTab;
  onTab: (tab: CoachTab) => void;
  revisions: readonly { revision: PreparedRevision; available: boolean }[];
  onRefine: (revision: PreparedRevision) => void;
  /** Words over the limit, 0 when it fits. */
  over: number;
  /** Share of the draft in the applicant's own words, 0..1. */
  ownShare: number;
  openNeeds: number;
}

const PROMPT_PARTS = [
  {
    part: "A time you took responsibility for something not yours to fix",
    where: "paragraphs 1 to 3",
  },
  { part: "What changed because of you", where: "paragraph 4" },
];

const OPTIONS = [
  {
    label: "Option A",
    recommended: true,
    angle: "The night-shift fix, told as one night",
    opening: "It was 2 a.m. and the feed from the lab system was dropping every fourth message.",
    tradeOff: "Vivid and specific; says less about what happened in the months after.",
  },
  {
    label: "Option B",
    recommended: false,
    angle: "The night-shift fix, told through the runbook you wrote",
    opening: "The runbook on my desk still has a coffee stain on page one.",
    tradeOff: "Shows lasting change; the tension of the night arrives later.",
  },
  {
    label: "Option C",
    recommended: false,
    angle: "The vendor who said no",
    opening: "Last year a vendor told me our hospital was too small to matter.",
    tradeOff: "Strong, but it is already the main story of Essay 3.",
  },
];

const VERIFY = [
  "4:40 a.m.: the time you found the timeout",
  "Your manager left two weeks before the go-live",
  "“Analyst” as your title at the time",
];

export function CoachPane({
  tab,
  onTab,
  revisions,
  onRefine,
  over,
  ownShare,
  openNeeds,
}: CoachPaneProps) {
  const ask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Any request returns the next prepared change; the real Refine engine arrives in Phase 4.
    const next = revisions.find((entry) => entry.available);
    if (next) onRefine(next.revision);
    event.currentTarget.reset();
  };

  return (
    <Tabs value={tab} onValueChange={(value) => onTab(value as CoachTab)} className="flex flex-col">
      <TabsList aria-label="Coach" className="px-3">
        <TabsTrigger value="why">Why this</TabsTrigger>
        <TabsTrigger value="options">Options</TabsTrigger>
        <TabsTrigger value="refine">Refine</TabsTrigger>
        <TabsTrigger value="checks">Checks</TabsTrigger>
        <TabsTrigger value="verify">Verify</TabsTrigger>
      </TabsList>

      <TabsContent value="why" className="flex flex-col gap-5 p-5">
        <h2 className="text-lg font-semibold text-text">Why this draft</h2>
        <p className="text-text">
          Story: <span className="font-medium">The night-shift fix</span>. It shows you taking
          ownership without a title, which Northfield asks for directly. Essay 2 covers how you
          build communities, so this essay stays at work.
        </p>
        <section aria-labelledby="prompt-parts" className="flex flex-col gap-2">
          <h3 id="prompt-parts" className="font-medium text-text">
            How it answers the prompt
          </h3>
          <ul className="flex flex-col gap-2">
            {PROMPT_PARTS.map((item) => (
              <li key={item.part} className="flex flex-col gap-0.5">
                <StatusLabel tone="verified">Answered in {item.where}</StatusLabel>
                <span className="text-text-soft">{item.part}</span>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-text-soft">
          Your recommender covers the vendor negotiation, so the essay leaves it out.
        </p>
      </TabsContent>

      <TabsContent value="options" className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold text-text">Options</h2>
        <ul className="flex flex-col divide-y divide-edge">
          {OPTIONS.map((option) => (
            <li key={option.label} className="flex flex-col gap-1 py-3">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-text">
                  {option.label}: {option.angle}
                </span>
                {option.recommended ? <StatusLabel tone="verified">Recommended</StatusLabel> : null}
              </p>
              <p className="font-reading text-text">“{option.opening}”</p>
              <p className="text-sm text-text-soft">{option.tradeOff}</p>
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="refine" className="flex flex-col gap-5 p-5">
        <h2 className="text-lg font-semibold text-text">Refine</h2>
        <form onSubmit={ask} className="flex flex-col gap-3">
          <TextField
            label="Ask for a change"
            name="request"
            autoComplete="off"
            hint="Each change comes back for you to keep or undo."
          />
          <Button type="submit" variant="secondary" className="self-start">
            Ask for this change
          </Button>
        </form>
        <section aria-labelledby="quick-actions" className="flex flex-col gap-2">
          <h3 id="quick-actions" className="font-medium text-text">
            Quick changes
          </h3>
          <ul className="flex flex-wrap gap-2">
            {revisions.map(({ revision, available }) => (
              <li key={revision.action}>
                <Button
                  variant="secondary"
                  icon={available ? undefined : CheckIcon}
                  disabled={!available}
                  onClick={() => onRefine(revision)}
                >
                  {available ? revision.action : `${revision.action}, applied`}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </TabsContent>

      <TabsContent value="checks" className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold text-text">Checks</h2>
        <ul className="flex flex-col gap-3">
          {over > 0 ? (
            <li className="flex flex-col gap-0.5">
              <StatusLabel tone="risk">Must fix</StatusLabel>
              <span className="text-text">
                {over} {over === 1 ? "word" : "words"} over. Cut to limit?
              </span>
            </li>
          ) : (
            <li className="flex flex-col gap-0.5">
              <StatusLabel tone="verified">Within the limit</StatusLabel>
              <span className="text-text-soft">The count matches how Northfield counts words.</span>
            </li>
          )}
          {openNeeds > 0 ? (
            <li className="flex flex-col gap-0.5">
              <StatusLabel tone="needs">Needs you</StatusLabel>
              <span className="text-text">
                {openNeeds === 1 ? "One detail is" : `${openNeeds} details are`} missing from the
                draft.
              </span>
            </li>
          ) : null}
          <li className="flex flex-col gap-0.5">
            <StatusLabel tone="neutral">Consider</StatusLabel>
            <span className="text-text">
              “I learned” in paragraph 4 tells the lesson. The runbook line already shows it.
            </span>
          </li>
          <li className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-soft">Your own words</span>
            <span className="text-text tabular-nums">
              {Math.round(ownShare * 100)}% of this draft. Aim for 40% to 70% in a personal essay.
            </span>
          </li>
        </ul>
      </TabsContent>

      <TabsContent value="verify" className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold text-text">Verify</h2>
        <p className="text-text-soft">Confirm these before you submit.</p>
        <ul className="flex flex-col gap-3">
          {VERIFY.map((item) => (
            <li key={item} className="flex flex-col gap-0.5">
              <StatusLabel tone="needs">Needs you</StatusLabel>
              <span className="text-text">{item}</span>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}
