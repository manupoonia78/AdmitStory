"use client";

import {
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  WarningOctagonIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useId } from "react";
import { Button } from "../../components/button";
import { cx } from "../../lib/cx";
import type { DraftPatch } from "../revision";

export type CheckSeverity = "must" | "should" | "consider";

/**
 * A linter or critic finding (Appendix I `Finding`, the `@admitstory/linters` shape). `patch`
 * is present only when the fix is mechanical and safe: then the item offers a one-click fix.
 */
export interface CheckFinding {
  rule_id: string;
  severity: CheckSeverity;
  location: { paragraph_id: string | null; sentence: number | null };
  explanation: string;
  fix_hint: string | null;
  patch?: DraftPatch;
}

export const CHECK_GROUPS: readonly {
  severity: CheckSeverity;
  label: string;
  icon: Icon;
  tone: string;
}[] = [
  { severity: "must", label: "Must fix", icon: WarningOctagonIcon, tone: "text-risk" },
  { severity: "should", label: "Should fix", icon: WarningIcon, tone: "text-needs" },
  { severity: "consider", label: "Consider", icon: InfoIcon, tone: "text-text-soft" },
];

/** The fix button's words: the fix hint when it is short enough to be a button, else generic. */
export function fixLabel(finding: Pick<CheckFinding, "fix_hint">): string {
  const hint = finding.fix_hint?.trim().replace(/\.$/u, "");
  return hint && hint.length <= 32 ? hint : "Apply the suggested fix";
}

export interface CheckItemProps {
  finding: CheckFinding;
  /** 1-based paragraph number for "Paragraph 2", or null for a draft-level finding. */
  paragraphNumber?: number | null;
  /** Apply `finding.patch`. Shown only when the finding has one. */
  onFix?: (finding: CheckFinding) => void;
  /** Move the caret to the paragraph the finding is about. */
  onLocate?: (finding: CheckFinding) => void;
  /** A finding-specific action, e.g. "Suggest another story" for a reused story (spec §6.9). */
  action?: { label: string; onAction: (finding: CheckFinding) => void };
  className?: string;
}

/** One check: where, what and why in a plain sentence, the hint, and a one-click fix when safe. */
export function CheckItem({
  finding,
  paragraphNumber,
  onFix,
  onLocate,
  action,
  className,
}: CheckItemProps) {
  return (
    <li data-rule={finding.rule_id} className={cx("flex flex-col gap-1.5 py-3", className)}>
      {paragraphNumber ? (
        <p className="text-sm text-text-soft">Paragraph {paragraphNumber}</p>
      ) : null}
      <p className="text-text">{finding.explanation}</p>
      {finding.fix_hint && !finding.patch ? (
        <p className="text-sm text-text-soft">{finding.fix_hint}</p>
      ) : null}
      {(finding.patch && onFix) || (onLocate && finding.location.paragraph_id) || action ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {finding.patch && onFix ? (
            <Button size="sm" onClick={() => onFix(finding)}>
              {fixLabel(finding)}
            </Button>
          ) : null}
          {action ? (
            <Button size="sm" variant="secondary" onClick={() => action.onAction(finding)}>
              {action.label}
            </Button>
          ) : null}
          {onLocate && finding.location.paragraph_id ? (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => onLocate(finding)}
              aria-label={
                paragraphNumber
                  ? `Show paragraph ${paragraphNumber} in the draft`
                  : "Show in the draft"
              }
            >
              Show in the draft
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export interface CheckListProps {
  findings: readonly CheckFinding[];
  /** Paragraph ids in draft order, to say "Paragraph 2". */
  paragraphIds?: readonly string[];
  onFix?: CheckItemProps["onFix"];
  onLocate?: CheckItemProps["onLocate"];
  /** A finding-specific action per rule, e.g. { storyReuse: "Suggest another story" }. */
  actions?: Readonly<Record<string, CheckItemProps["action"]>>;
  /** Voice fidelity (spec §8.7), shown as information with the target range. */
  fidelity?: { share: number; target: readonly [number, number] } | null;
}

/**
 * Coach tab 4, "Checks" (spec §5.8, §8.8): findings grouped Must fix, Should fix and Consider,
 * each group with an icon and a word. One-click fixes where the finding carries a safe patch.
 */
export function CheckList({
  findings,
  paragraphIds = [],
  onFix,
  onLocate,
  actions = {},
  fidelity,
}: CheckListProps) {
  const id = useId();
  const number = (finding: CheckFinding) => {
    const at = finding.location.paragraph_id
      ? paragraphIds.indexOf(finding.location.paragraph_id)
      : -1;
    return at >= 0 ? at + 1 : null;
  };
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-text">Checks</h2>
      {findings.length === 0 ? (
        <p className="inline-flex items-center gap-1 font-medium text-verified">
          <CheckCircleIcon size={16} aria-hidden />
          Every check passes.
        </p>
      ) : null}
      {CHECK_GROUPS.map((group) => {
        const items = findings.filter((finding) => finding.severity === group.severity);
        if (items.length === 0) return null;
        const GroupIcon = group.icon;
        return (
          <section
            key={group.severity}
            aria-labelledby={`${id}-${group.severity}`}
            className="flex flex-col"
          >
            <h3
              id={`${id}-${group.severity}`}
              className={cx("inline-flex items-center gap-1 font-medium", group.tone)}
            >
              <GroupIcon size={16} aria-hidden className="shrink-0" />
              {group.label}
              <span className="font-normal tabular-nums text-text-soft">({items.length})</span>
            </h3>
            <ul className="flex flex-col divide-y divide-edge">
              {items.map((finding, index) => (
                <CheckItem
                  key={`${finding.rule_id}:${finding.location.paragraph_id ?? ""}:${finding.location.sentence ?? ""}:${index}`}
                  finding={finding}
                  paragraphNumber={number(finding)}
                  onFix={onFix}
                  onLocate={onLocate}
                  action={actions[finding.rule_id]}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {fidelity ? (
        <section
          aria-labelledby={`${id}-fidelity`}
          className="flex flex-col gap-0.5 border-t border-edge pt-4"
        >
          <h3 id={`${id}-fidelity`} className="text-sm font-medium text-text-soft">
            Your own words
          </h3>
          <p className="text-text tabular-nums">
            {Math.round(fidelity.share * 100)}% of this draft. Aim for{" "}
            {Math.round(fidelity.target[0] * 100)}% to {Math.round(fidelity.target[1] * 100)}% in
            this kind of essay.
          </p>
        </section>
      ) : null}
    </div>
  );
}
