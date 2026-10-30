"use client";

import {
  ImmersiveScope,
  SkipLink,
  ThemeToggle,
  voiceHueStyle,
  type ThemePreference,
} from "@admitstory/ui";
import { APP_NAME } from "@admitstory/shared";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FrameHud } from "./frame-hud";
import { usePrototypeIdentity } from "./identity";

/**
 * The frame every prototype renders in: Night unless Day was chosen (ImmersiveScope), the
 * prototype applicant's hue on --voice, a slim header, and the frame HUD. Pages render their
 * content straight into <main>; they should not add another <main>.
 */
export function PrototypeFrame({
  theme,
  children,
}: {
  theme: ThemePreference;
  children: ReactNode;
}) {
  const [, , hueIndex] = usePrototypeIdentity();
  return (
    <ImmersiveScope
      serverValue={theme}
      style={voiceHueStyle(hueIndex)}
      className="flex min-h-dvh flex-col"
    >
      <SkipLink targetId="main" />
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge px-4 sm:px-8">
        <Link
          href="/prototype"
          className="rounded-control text-sm font-semibold text-text underline decoration-transparent underline-offset-[0.2em] hover:decoration-current"
        >
          {APP_NAME} prototypes
        </Link>
        <ThemeToggle serverValue={theme} compact />
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <Suspense fallback={null}>
        <FrameHud />
      </Suspense>
    </ImmersiveScope>
  );
}
