"use client";

// Starts Lenis on the first wheel event, on desktop with a fine pointer and motion welcome
// (plan §3.5: smoothScrollGate). Phones, tablets, touch and reduced motion keep native scroll.
// Renders nothing; Lenis itself loads with import() only when the gate opens.

import { useEffect } from "react";
import { smoothScrollGate } from "../_lib/gates";
import { desktopMotion } from "./media";
import { destroyLenis, startLenis } from "./smooth-scroll";

export function SmoothScrollHost() {
  useEffect(() => {
    if (smoothScrollGate({ desktop: desktopMotion(), wheel: false }) === "never") return;
    const onWheel = () => {
      if (smoothScrollGate({ desktop: desktopMotion(), wheel: true }) === "load") void startLenis();
    };
    window.addEventListener("wheel", onWheel, { once: true, passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      destroyLenis();
    };
  }, []);
  return null;
}
