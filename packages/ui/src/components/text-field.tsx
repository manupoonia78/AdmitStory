import { WarningCircleIcon } from "@phosphor-icons/react/ssr";
import { Label as LabelPrimitive } from "radix-ui";
import {
  useId,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../lib/cx";

export function Label({ className, ...rest }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cx("text-base font-medium text-graphite", className)}
      {...rest}
    />
  );
}

export function FieldHint({ className, ...rest }: ComponentProps<"p">) {
  return <p className={cx("text-sm text-slate", className)} {...rest} />;
}

/** Error text says what to do, not just what went wrong. Icon + text, never colour alone. */
export function FieldError({ className, children, ...rest }: ComponentProps<"p">) {
  return (
    <p className={cx("flex items-start gap-1 text-sm font-medium text-risk", className)} {...rest}>
      <WarningCircleIcon size={16} aria-hidden className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export interface FieldErrorRegionProps {
  /** The id the field points at with aria-describedby. Given to the error, not the region. */
  id: string;
  /** The message, or nothing while the field is valid. */
  error?: ReactNode;
  /** Classes for the error text. */
  className?: string;
}

/**
 * Where a field's error appears. The polite live region is always in the DOM, even while it is
 * empty, so screen readers announce an error the moment it is added (WCAG 3.3.1, 4.1.3); a region
 * created together with its text is often not read. It takes no space while empty.
 */
export function FieldErrorRegion({ id, error, className }: FieldErrorRegionProps) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {error ? (
        <FieldError id={id} className={cx("mt-1", className)}>
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}

// Control borders use --slate, not --line, so the edge meets 3:1 (WCAG 1.4.11).
const INPUT =
  "min-h-11 w-full rounded-control border border-slate bg-paper px-3 py-2 text-base text-graphite " +
  "placeholder:text-slate aria-invalid:border-risk disabled:cursor-not-allowed disabled:opacity-60";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "children"> {
  label: ReactNode;
  hint?: ReactNode;
  /** When set, the field is marked invalid and the message is read with it. */
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  /** Classes for the wrapper; the input itself keeps the system styling. */
  className?: string;
}

export function TextField({
  label,
  hint,
  error,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedByIds = [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={inputId}>{label}</Label>
        {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
        <input
          ref={ref}
          id={inputId}
          className={INPUT}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds}
          {...rest}
        />
      </div>
      <FieldErrorRegion id={`${inputId}-error`} error={error} />
    </div>
  );
}
