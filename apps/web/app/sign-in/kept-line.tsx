"use client";

// /sign-in?from=line (plan §5 step 2): the line the visitor kept on our homepage, under "Keep your
// first line", in their own light. It arrives under the same <SharedElement> name as the landing
// page's line, so the line flies here. It lives only in this browser (lib/marketing/first-line.ts):
// with nothing stored, or storage blocked, the box holds the ordinary heading instead. The box is
// two reading lines tall either way, so nothing below it moves.

import { SharedElement, paramsFromIdentity, voiceHueStyle } from "@admitstory/ui";
import { DEFAULT_IDENTITY } from "@admitstory/shared";
import { useSyncExternalStore } from "react";
import { KEEP_LINE_COPY } from "@/app/(marketing)/_copy/keep-line";
import {
  FIRST_LINE_TRANSITION,
  readFirstLine,
  subscribeFirstLine,
  type FirstLine,
} from "@/lib/marketing/first-line";

/** Before hydration we can't read storage; assume the line is there (this page came from it). */
const PENDING = "pending" as const;
type Kept = FirstLine | null | typeof PENDING;
const readKept = (): Kept => readFirstLine();
const readPending = (): Kept => PENDING;

export function KeptLine({ fallbackHeadline }: { fallbackHeadline: string }) {
  const kept = useSyncExternalStore(subscribeFirstLine, readKept, readPending);

  // One box for both states: the heading plus two reading lines (19/32), so nothing shifts.
  const box = "flex min-h-30 flex-col justify-end gap-3";
  if (kept === null) {
    return (
      <div className={box}>
        <h1 className="text-display-sm text-text">{fallbackHeadline}</h1>
      </div>
    );
  }

  const identity = kept === PENDING ? DEFAULT_IDENTITY : (kept.identity ?? DEFAULT_IDENTITY);
  return (
    <div className={box} style={voiceHueStyle(paramsFromIdentity(identity).hueIndex)}>
      <h1 className="text-display-sm text-text">{KEEP_LINE_COPY.signInHeading}</h1>
      <SharedElement name={FIRST_LINE_TRANSITION}>
        <p className="line-clamp-2 min-h-16 font-reading text-read text-voice [text-shadow:0_0_24px_var(--voice-glow)]">
          {kept === PENDING ? null : kept.line}
        </p>
      </SharedElement>
    </div>
  );
}
