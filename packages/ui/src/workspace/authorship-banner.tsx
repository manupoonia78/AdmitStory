"use client";

import { CopyIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { Button } from "../components/button";
import { cx } from "../lib/cx";
import { verifiedDate } from "./coach/source-line";

/** Spec §8.10: what the engine may write for this deliverable. */
export type AuthorshipMode = "draft" | "coach" | "talking_points";

/** A school's AI policy stance (spec §14.2, §9.2 `ai_policy`). */
export type AiPolicyStance =
  "permitted" | "permitted_with_disclosure" | "limited" | "prohibited" | "unknown";

/** From most to least generated prose. The applicant may only move right (spec §14.2). */
export const AUTHORSHIP_ORDER: readonly AuthorshipMode[] = ["draft", "coach", "talking_points"];

/** The modes stricter than `mode` that a user may choose for themselves. */
export function stricterModes(mode: AuthorshipMode): AuthorshipMode[] {
  return AUTHORSHIP_ORDER.slice(AUTHORSHIP_ORDER.indexOf(mode) + 1).filter(
    // Talking points are for spoken components; essays go no further than coach mode.
    (m) => m !== "talking_points",
  );
}

export const MODE_LABELS: Record<AuthorshipMode, string> = {
  draft: "Draft mode",
  coach: "Coach mode",
  talking_points: "Talking points",
};

/** The one-line explanation (spec §8.10), with the school's name. */
export function modeExplanation(
  mode: AuthorshipMode,
  stance: AiPolicyStance,
  school: string,
): string {
  if (mode === "talking_points") {
    return "Spoken answers get talking points, never a script to read.";
  }
  if (mode === "coach") {
    if (stance === "prohibited") {
      return `${school} doesn't allow AI-written prose, so we give you structure, your own lines and questions. You write every sentence.`;
    }
    if (stance === "limited") {
      return `${school} limits AI help, so we give you a beat outline, your own lines and questions, and light edits to your writing.`;
    }
    return "You chose to write it yourself: we give you a beat outline, your own lines and questions.";
  }
  if (stance === "permitted_with_disclosure") {
    return `${school} allows AI help if you say how you used it. A disclosure is drafted below for you to edit.`;
  }
  if (stance === "unknown") {
    return `${school} hasn't published an AI policy. Drafts are built from your own words, and we re-check each cycle.`;
  }
  return `${school} allows AI help. Drafts are built from your own words and every sentence shows its source.`;
}

export interface AuthorshipBannerProps {
  mode: AuthorshipMode;
  stance: AiPolicyStance;
  school: string;
  /** The school's own policy page, with the date it was verified. */
  policy?: { url: string; verifiedAt: string } | null;
  /** For permitted_with_disclosure: the pre-filled disclosure, editable (spec §14.2). */
  disclosure?: { text: string; onChange: (text: string) => void } | null;
  /** Offer the stricter modes (spec §14.2: the user can always choose a stricter mode). */
  onChooseMode?: (mode: AuthorshipMode) => void;
  className?: string;
}

/**
 * The authorship mode in the Workspace header (spec §8.10, §14.2): the mode, one line on why,
 * a link to the school's policy, and for schools that want a disclosure, an honest one to edit
 * and copy.
 */
export function AuthorshipBanner({
  mode,
  stance,
  school,
  policy,
  disclosure,
  onChooseMode,
  className,
}: AuthorshipBannerProps) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const stricter = onChooseMode ? stricterModes(mode) : [];
  const copy = async () => {
    if (!disclosure) return;
    try {
      await navigator.clipboard.writeText(disclosure.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section
      aria-labelledby={`${id}-mode`}
      className={cx("flex flex-col gap-2 text-base", className)}
    >
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span id={`${id}-mode`} className="font-medium text-text">
          {MODE_LABELS[mode]}
        </span>
        <span className="text-text-soft">{modeExplanation(mode, stance, school)}</span>
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-soft">
        {policy ? (
          <span>
            <a
              href={policy.url}
              target="_blank"
              rel="noreferrer"
              className="text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
            >
              {school}’s AI policy
            </a>
            , verified {verifiedDate(policy.verifiedAt)}
          </span>
        ) : null}
        {stricter.map((next) => (
          <button
            key={next}
            type="button"
            onClick={() => onChooseMode?.(next)}
            className="relative rounded-control text-signal underline decoration-1 underline-offset-[0.2em] hover:decoration-2 before:absolute before:-inset-x-1 before:top-1/2 before:h-11 before:-translate-y-1/2"
          >
            Switch to {MODE_LABELS[next].toLowerCase()}
          </button>
        ))}
      </p>
      {stance === "permitted_with_disclosure" && disclosure ? (
        <div className="flex flex-col gap-2 pt-1">
          <label htmlFor={`${id}-disclosure`} className="font-medium text-text">
            Your AI disclosure
          </label>
          <p id={`${id}-disclosure-hint`} className="text-sm text-text-soft">
            Drafted from how you used Admitstory. Edit it so it’s true in your words.
          </p>
          <textarea
            id={`${id}-disclosure`}
            rows={3}
            value={disclosure.text}
            aria-describedby={`${id}-disclosure-hint`}
            onChange={(event) => {
              setCopied(false);
              disclosure.onChange(event.target.value);
            }}
            className="w-full resize-y rounded-control border border-control bg-depth px-3 py-2 text-lg text-text sm:text-base"
          />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" icon={CopyIcon} onClick={copy}>
              Copy disclosure
            </Button>
            <span aria-live="polite" className="text-sm text-text-soft">
              {copied ? "Disclosure copied." : ""}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
