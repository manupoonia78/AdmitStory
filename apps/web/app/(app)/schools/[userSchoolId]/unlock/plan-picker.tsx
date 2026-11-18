"use client";

import { cx } from "@admitstory/ui";
import { CheckIcon } from "@phosphor-icons/react";
import { useRef } from "react";
import {
  FEATURED_PLAN,
  PLAN_ORDER,
  SCHOOL_PLANS,
  dollars,
  listCents,
  perSchoolCents,
  savingCents,
  type PlanId,
} from "@/lib/payments/plans";
import { PACK_PITCH } from "@/lib/payments/pitch";

// The three ways to pay (Manu, 5 Nov 2026; SPEC §6.8): this school, 5 schools or 10. Native radios
// in a fieldset, laid out as three boxes on one baseline; the 5-school pack is the default and the
// only one with a badge, with the one-at-a-time price struck through beside it. The chosen box is
// the only filled one. `onChange` says whether a pointer chose it, so only a click deals the pack
// (a keyboard change shows the new count at once, SPEC §2.10).

export function PlanPicker({
  value,
  onChange,
  school,
  disabled,
}: {
  value: PlanId;
  onChange: (plan: PlanId, via: "pointer" | "key") => void;
  school: string;
  disabled?: boolean;
}) {
  const pointer = useRef(false);
  return (
    <fieldset
      className="grid gap-3 sm:grid-cols-3"
      disabled={disabled}
      onPointerDown={() => {
        pointer.current = true;
      }}
      onKeyDown={() => {
        pointer.current = false;
      }}
    >
      <legend className="sr-only">How many schools</legend>
      {PLAN_ORDER.map((id) => {
        const plan = SCHOOL_PLANS[id];
        const checked = value === id;
        const featured = id === FEATURED_PLAN;
        const pack = plan.schools > 1;
        return (
          <label
            key={id}
            className={cx(
              "relative flex min-w-0 cursor-pointer flex-col rounded-card border px-5 py-6 sm:min-h-[12.25rem]",
              "transition-[background-color,border-color,box-shadow] duration-150 ease-rise motion-reduce:transition-none",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-text",
              checked
                ? "border-text bg-depth shadow-[inset_0_0_0_0.5px_var(--text),var(--shadow-paper)]"
                : "border-edge bg-transparent hover:border-control",
            )}
          >
            <input
              type="radio"
              name="plan"
              value={id}
              checked={checked}
              onChange={() => onChange(id, pointer.current ? "pointer" : "key")}
              className="sr-only"
            />
            <span className="flex min-h-6 items-center justify-between gap-2">
              <span className="text-ui text-text">{plan.name}</span>
              {checked ? (
                <span
                  aria-hidden
                  className="grid size-5 place-items-center rounded-full bg-text text-space"
                >
                  <CheckIcon size={12} weight="bold" />
                </span>
              ) : (
                <span aria-hidden className="size-5 rounded-full border border-edge-strong" />
              )}
            </span>
            {featured ? (
              <span className="label frost-flat mt-3 inline-flex h-6 items-center self-start rounded-full px-2.5 text-text">
                {PACK_PITCH.badge}
              </span>
            ) : (
              <span aria-hidden className="mt-3 h-6" />
            )}
            <span className="mt-auto flex flex-wrap items-baseline gap-x-2.5 pt-5">
              <span className="text-[2.5rem] leading-none font-[450] tracking-[-0.03em] text-text tabular-nums">
                {dollars(plan.priceCents)}
              </span>
              {pack ? (
                <s className="font-mono text-[13px] text-text-soft decoration-1 tabular-nums">
                  <span className="sr-only">instead of </span>
                  {dollars(listCents(plan))}
                </s>
              ) : null}
            </span>
            <span className="mt-3 font-mono text-[12px] tracking-[0.06em] text-text-soft uppercase tabular-nums">
              {pack
                ? `${dollars(perSchoolCents(plan))} a school · save ${dollars(savingCents(plan))}`
                : `Just ${school}`}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
