"use client";

import { QuestionIcon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "../lib/cx";

export interface NeedChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The question as the applicant will read it: "What did your manager say when you told him?" */
  question: string;
  /** Roughly how long a good answer is. */
  approxWords: number;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A real detail the draft is missing, sitting where it belongs in the text (spec §5.8 [NEED]
 * chips, §6.9 "What did your manager say when you told him? About 20 words."). It opens a small
 * composer; the draft never invents the answer (spec §8.7). --needs with an icon and words, on the
 * sheet's --depth (status colours never sit on --veil). Buttons lay out as inline blocks, so a long
 * question wraps inside the chip rather than with the surrounding line.
 */
export function NeedChip({ question, approxWords, className, type, ref, ...rest }: NeedChipProps) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cx(
        "inline-block max-w-full rounded-control border border-dashed border-needs px-1.5 py-0.5 text-left align-baseline",
        "font-ui text-base text-needs hover:border-solid",
        className,
      )}
      {...rest}
    >
      <QuestionIcon size={16} aria-hidden className="mr-1 inline-block align-[-0.15em]" />
      <span className="sr-only">Needs you:</span> {`${question} About ${approxWords} words.`}
    </button>
  );
}
