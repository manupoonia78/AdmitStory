"use client";

// The studio behind the page (studio-scene.ts). This host is all that ships in first-load JS: a
// fixed canvas, a CSS-lit fallback that is already in place at first paint, and an idle import of
// the WebGL scene. The canvas fades in over the fallback on its first frame. No WebGL2, Save-Data
// or a lost context leave the fallback, which is designed to stand on its own.

import { useEffect, useRef } from "react";
import { whenIdle } from "../shell/when-idle";
import { sceneForPath, type SceneId } from "./scene-ids";
import type { SceneFrame, Studio } from "./studio-scene";

export interface SceneHostProps {
  /** The route; the scene follows it (scene-ids.ts) and morphs when it changes. */
  pathname: string;
  /** Pins a scene regardless of the route. */
  scene?: SceneId;
}

function frameFor(): SceneFrame {
  const w = window.innerWidth;
  if (w < 640) return { x: 0.82, y: 0.1, scale: 0.5 };
  if (w < 1024) return { x: 0.8, y: 0.24, scale: 0.8 };
  return { x: 0.8, y: 0.42, scale: 1 };
}

function readTheme(): { day: boolean; hues: [string, string] } {
  const style = getComputedStyle(document.body);
  const day = style.colorScheme.trim() === "light";
  // --voice is a light-dark() pair that custom-property computation leaves unresolved.
  const voice = style.getPropertyValue(day ? "--voice-day" : "--voice-night").trim();
  return { day, hues: [style.getPropertyValue("--signal").trim(), voice] };
}

export function SceneHost({ pathname, scene }: SceneHostProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const studio = useRef<Studio | null>(null);
  const id = scene ?? sceneForPath(pathname);
  // The scene to open on once WebGL loads; kept current by the effect below.
  const current = useRef(id);

  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];

    cleanups.push(
      whenIdle(() => {
        void import("./studio-scene").then(({ createStudio }) => {
          const el = canvas.current;
          if (disposed || !el) return;
          const theme = readTheme();
          const made = createStudio(el, {
            scene: current.current,
            frame: frameFor(),
            day: theme.day,
            hues: theme.hues,
            still: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            onFirstFrame: () => root.current?.setAttribute("data-live", ""),
          });
          if (!made) return;
          studio.current = made;

          const retheme = () => {
            const next = readTheme();
            made.setTheme(next.day, next.hues);
          };
          const observer = new MutationObserver(retheme);
          observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
          const media = window.matchMedia("(prefers-color-scheme: dark)");
          media.addEventListener("change", retheme);
          const reframe = () => made.setScene(current.current, frameFor());
          window.addEventListener("resize", reframe);
          cleanups.push(() => {
            observer.disconnect();
            media.removeEventListener("change", retheme);
            window.removeEventListener("resize", reframe);
            made.destroy();
            studio.current = null;
          });
        });
      }),
    );
    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  useEffect(() => {
    current.current = id;
    studio.current?.setScene(id, frameFor());
  }, [id]);

  return (
    <div ref={root} aria-hidden className="studio" data-scene={id}>
      <canvas ref={canvas} className="studio-canvas" />
    </div>
  );
}
