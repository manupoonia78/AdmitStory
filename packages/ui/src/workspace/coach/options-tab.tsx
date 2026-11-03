"use client";

import { StatusLabel } from "../../components/status-label";
import { Button } from "../../components/button";

/** One angle as the Options tab shows it (Appendix I `Angle`, with story titles resolved). */
export interface OptionSummary {
  label: "A" | "B" | "C";
  pitch: string;
  openingLine: string;
  /** Story titles, in order. */
  stories: readonly string[];
  /** Trade-offs (Angle.risks). */
  risks: readonly string[];
  recommended: boolean;
  /** Why it is or isn't recommended (Angle.reason). */
  reason: string;
  /** A draft of it exists. */
  drafted: boolean;
  /** It is the draft on the canvas. */
  inUse: boolean;
}

export interface OptionsTabProps {
  options: readonly OptionSummary[];
  /** "Draft this option": stage 6 drafts alternatives on demand (spec §5.7). */
  onDraft?: (label: OptionSummary["label"]) => void;
  /** "Compare side by side" with the draft in use (OptionSplit). */
  onCompare?: (label: OptionSummary["label"]) => void;
  onUse?: (label: OptionSummary["label"]) => void;
  /** The option being drafted now, if any: its button says so and the others wait. */
  drafting?: OptionSummary["label"] | null;
}

/**
 * Coach tab 2, "Options" (spec §5.8): options A, B and C as compact comparisons: the angle, its
 * stories, the opening line, the trade-offs, and our recommendation with the reason. Each offers
 * "Draft this option" until drafted, then "Compare side by side" and "Use this option".
 */
export function OptionsTab({
  options,
  onDraft,
  onCompare,
  onUse,
  drafting = null,
}: OptionsTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-text">Options</h2>
      <ul className="flex flex-col divide-y divide-edge">
        {options.map((option) => {
          const name = `Option ${option.label}`;
          return (
            <li key={option.label} className="flex flex-col gap-2 py-4 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-text">
                  {name}: {option.pitch}
                </h3>
                {option.inUse ? (
                  <StatusLabel tone="neutral">In your draft</StatusLabel>
                ) : option.recommended ? (
                  <StatusLabel tone="verified">Recommended</StatusLabel>
                ) : null}
              </div>
              {option.stories.length > 0 ? (
                <p className="text-sm text-text-soft">
                  {option.stories.length === 1 ? "Story" : "Stories"}: {option.stories.join(", ")}
                </p>
              ) : null}
              <p className="font-reading text-read text-text">“{option.openingLine}”</p>
              {option.risks.length > 0 ? (
                <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-text-soft">
                  {option.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              ) : null}
              <p className="text-sm text-text">
                <span className="font-medium">
                  {option.recommended ? "Why we recommend it: " : "Why not first: "}
                </span>
                {option.reason}
              </p>
              {option.inUse ? null : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {!option.drafted && onDraft ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={drafting === option.label}
                      disabled={drafting !== null && drafting !== option.label}
                      onClick={() => onDraft(option.label)}
                      aria-label={drafting === option.label ? `Drafting ${name}` : `Draft ${name}`}
                    >
                      {drafting === option.label ? "Drafting" : "Draft this option"}
                    </Button>
                  ) : null}
                  {option.drafted && onCompare ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onCompare(option.label)}
                      aria-label={`Compare ${name} side by side`}
                    >
                      Compare side by side
                    </Button>
                  ) : null}
                  {option.drafted && onUse ? (
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => onUse(option.label)}
                      aria-label={`Use ${name}`}
                    >
                      Use this option
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
