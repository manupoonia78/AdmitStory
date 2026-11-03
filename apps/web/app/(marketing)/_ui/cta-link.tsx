// Calls to action (plan §3.3): next/link styled with buttonStyles(), so no client code per link.
// `track` adds data-track attributes; the layout's one delegated listener sends the event.
// Buttons name the exact action (§6.9) and never carry an arrow (§6.1).

import { buttonStyles, cx } from "@admitstory/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { trackAttributes, type CtaLocation } from "../_lib/track";

export type CtaVariant = "primary" | "ghost" | "text";

/** The text-link look: --signal, underlined on hover, with a 44 px target. */
export const TEXT_LINK =
  "inline-flex min-h-11 items-center text-signal underline-offset-4 decoration-1 hover:underline focus-visible:underline";

export function ctaClassName(variant: CtaVariant): string {
  if (variant === "text") return TEXT_LINK;
  return cx(
    buttonStyles({ variant: variant === "ghost" ? "secondary" : "primary" }),
    // 44 px tall on every page (spec §6.12); the nav's compact 40 px uses its own class.
    "min-h-11 px-5",
  );
}

export interface CtaLinkProps {
  href: string;
  variant?: CtaVariant;
  /** For "Start free" links: sends cta_start_free with this location. */
  track?: CtaLocation;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}

export function CtaLink({
  href,
  variant = "primary",
  track,
  className,
  children,
  prefetch,
}: CtaLinkProps) {
  const attributes = track ? trackAttributes("cta_start_free", { location: track }) : {};
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cx(ctaClassName(variant), className)}
      {...attributes}
    >
      {children}
    </Link>
  );
}

/** Where "Start free" goes: sign-in creates the account (there is no separate sign-up page). */
export const START_FREE_HREF = "/sign-in";
