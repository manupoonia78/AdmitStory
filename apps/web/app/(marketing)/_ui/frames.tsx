// Frames for real UI (plan §3.3). Server-safe, CSS only.
//
// PlaneFrame   a plane: --depth, 16 px radius, 1px --edge, and --plane-light in Night.
// ScaledFrame  a fixed design width (720 by default) scaled into a fixed aspect-ratio box with a
//              container query unit: scale = 100cqw / 720px, written as tan(atan2(100cqw, 720px))
//              because typed division isn't in every browser yet while trig functions are. No JS
//              measuring, no layout shift; the content inside lays out at the design width.

import { cx } from "@admitstory/ui";
import type { CSSProperties, ReactNode } from "react";

export function PlaneFrame({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "figure";
}) {
  return <Tag className={cx("plane overflow-hidden", className)}>{children}</Tag>;
}

export interface ScaledFrameProps {
  /** The width the content is designed at, in CSS px. */
  designWidth?: number;
  /** The design height; the box keeps designWidth / designHeight as its aspect ratio. */
  designHeight: number;
  className?: string;
  children: ReactNode;
}

export function ScaledFrame({
  designWidth = 720,
  designHeight,
  className,
  children,
}: ScaledFrameProps) {
  const outer: CSSProperties = {
    aspectRatio: `${designWidth} / ${designHeight}`,
    containerType: "inline-size",
  };
  const inner: CSSProperties = {
    width: designWidth,
    height: designHeight,
    transformOrigin: "0 0",
    transform: `scale(tan(atan2(100cqw, ${designWidth}px)))`,
  };
  return (
    <div className={cx("relative w-full overflow-hidden", className)} style={outer}>
      <div style={inner}>{children}</div>
    </div>
  );
}
