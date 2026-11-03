// A link that no longer opens (Phase 6 plan §8): expired, replaced by a newer one, revoked, or
// never ours. It says which, and nothing else: no applicant, no schools, no notes. A server
// component with no state, so a closed link ships no JavaScript beyond the resend form the page
// chooses to pass in.

import type { PortalClosedView } from "@admitstory/shared/kit";
import type { ReactNode } from "react";
import { closedCopy } from "./portal-text";

export interface PortalClosedProps {
  view: PortalClosedView;
  /** The "Send me a fresh link" form, shown only where a fresh link can exist. */
  resend?: ReactNode;
}

export function PortalClosed({ view, resend }: PortalClosedProps) {
  const copy = closedCopy(view);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-display-sm text-text">{copy.title}</h1>
      <p className="text-base text-text-soft">{copy.body}</p>
      {copy.resend && resend ? resend : null}
    </div>
  );
}
