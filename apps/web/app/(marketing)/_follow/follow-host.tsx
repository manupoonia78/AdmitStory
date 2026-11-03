"use client";

// Loads the pinned sequence (plan §9.2.3, followGate): desktop with a fine pointer, motion welcome
// and no Save-Data only; then when #follow is within one viewport, or on idle after load,
// whichever comes first. Phones, tablets, touch and reduced motion never request GSAP. Renders
// nothing; the sequence works on the server-rendered DOM and puts it back on cleanup.

import { useEffect, useRef } from "react";
import { followGate } from "../_lib/gates";
import { desktopMotion, whenIdle, whenLoaded } from "../_motion/media";

export function FollowHost() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = ref.current?.closest<HTMLElement>("#follow");
    const desktop = desktopMotion();
    if (
      !section ||
      followGate({ desktop, nearFollow: false, idleAfterRenderer: false }) === "never"
    ) {
      return;
    }
    let cancelled = false;
    let started = false;
    let cleanup: (() => void) | undefined;

    const start = () => {
      if (started || cancelled) return;
      started = true;
      observer?.disconnect();
      void import("./follow-sequence")
        .then(({ startFollow }) => {
          if (!cancelled) cleanup = startFollow(section);
        })
        .catch(() => {
          // GSAP didn't load: the stacked version stays, which is complete on its own.
        });
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              const nearFollow = entries.some((entry) => entry.isIntersecting);
              if (followGate({ desktop, nearFollow, idleAfterRenderer: false }) === "load") start();
            },
            { rootMargin: "100% 0px" },
          );
    observer?.observe(section);
    void whenLoaded()
      .then(() => whenIdle(3000))
      .then(() => {
        if (followGate({ desktop, nearFollow: false, idleAfterRenderer: true }) === "load") start();
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      cleanup?.();
    };
  }, []);

  return <span ref={ref} hidden />;
}
