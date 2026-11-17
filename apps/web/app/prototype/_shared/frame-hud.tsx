"use client";

// Frame HUD for screen-recording reviews (spec §6.13; GPU tiers left with the WebGL renderer).
// Shown only when the address has ?hud=1. It samples frames itself, so it measures whatever the
// page is animating.

import { createFrameMonitor, type FrameSnapshot } from "@admitstory/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const REFRESH_MS = 500;

export function FrameHud() {
  const show = useSearchParams().get("hud") === "1";
  return show ? <HudPanel /> : null;
}

function HudPanel() {
  const [frames, setFrames] = useState<FrameSnapshot | null>(null);

  useEffect(() => {
    const monitor = createFrameMonitor();
    monitor.start();
    const timer = window.setInterval(() => setFrames(monitor.snapshot()), REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      monitor.stop();
    };
  }, []);

  // Fixed width and tabular figures: the numbers change without the panel changing shape.
  return (
    <aside
      aria-label="Frame monitor"
      className="pointer-events-none fixed bottom-4 right-4 z-50 w-52 rounded-control border border-edge bg-depth px-3 py-2 text-sm text-text-soft tabular-nums shadow-plane"
    >
      <dl className="grid grid-cols-[1fr_auto] gap-x-3">
        <dt>Frame rate</dt>
        <dd className="text-right text-text">{frames ? `${frames.fps} fps` : "–"}</dd>
        <dt>p95 frame time</dt>
        <dd className="text-right text-text">{frames ? `${frames.p95FrameMs} ms` : "–"}</dd>
        <dt>Sustained slow</dt>
        <dd className="text-right text-text">{frames?.sustainedSlow ? "Yes" : "No"}</dd>
      </dl>
    </aside>
  );
}
