"use client";

import { cx } from "@admitstory/ui";
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

// The three ways to pay (Manu, 5 Nov 2026): this school, 5 schools or 10. Native radios in a
// fieldset, laid out as three planes; the 5-school pack is the default and the only one with a
// badge, with the one-at-a-time price struck through beside it.

export function PlanPicker({
  value,
  onChange,
  school,
  disabled,
}: {
  value: PlanId;
  onChange: (plan: PlanId) => void;
  school: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-3" disabled={disabled}>
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
              "relative flex cursor-pointer flex-col gap-1 rounded-plane border p-4 transition-colors duration-(--spring-snap-duration) ease-snap has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-signal motion-reduce:transition-none",
              checked ? "border-accent bg-veil" : "border-edge hover:border-control",
            )}
          >
            <input
              type="radio"
              name="plan"
              value={id}
              checked={checked}
              onChange={() => onChange(id)}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-2">
              <span className="text-base font-medium text-text">{plan.name}</span>
              {featured ? (
                <span className="rounded-control border border-accent px-1.5 py-0.5 text-sm text-accent">
                  {PACK_PITCH.badge}
                </span>
              ) : null}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-display-sm text-text tabular-nums">
                {dollars(plan.priceCents)}
              </span>
              {pack ? (
                <s className="text-sm text-text-soft tabular-nums">
                  <span className="sr-only">instead of </span>
                  {dollars(listCents(plan))}
                </s>
              ) : null}
            </span>
            <span className="text-sm text-text-soft">
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
