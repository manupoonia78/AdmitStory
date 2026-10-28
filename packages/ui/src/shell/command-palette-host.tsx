"use client";

import { lazy, Suspense, useState } from "react";
import type { CommandPaletteProps } from "./command-palette";

const loadPalette = () => import("./command-palette");
const LazyCommandPalette = lazy(() => loadPalette().then((m) => ({ default: m.CommandPalette })));

/** Start fetching the palette chunk early, e.g. when the trigger is hovered or focused. */
export function preloadCommandPalette() {
  void loadPalette();
}

/** Mounts the palette on first open only, so cmdk never ships in a route's initial JS. */
export function CommandPaletteHost(props: CommandPaletteProps) {
  const [hasOpened, setHasOpened] = useState(props.open);
  if (props.open && !hasOpened) setHasOpened(true);
  if (!hasOpened) return null;
  return (
    <Suspense fallback={null}>
      <LazyCommandPalette {...props} />
    </Suspense>
  );
}
