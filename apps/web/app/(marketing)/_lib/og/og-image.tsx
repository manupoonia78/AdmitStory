// The Open Graph template every marketing page uses (SPEC §4.2): 1200 × 630 on the instrument's
// dark, the wordmark top left, the page's headline with its accent line in Instrument Serif
// italic, and the horizon across the lower third with one brass peak. Static (no request APIs),
// so each image is generated once at build.
//
// Satori reads TTF/OTF, not the woff2 that next/font fetches, so the faces come from files: Geist
// Medium and Geist Mono from the installed `geist` package, and Instrument Serif italic from the
// TTF beside this file (SIL Open Font Licence, ./InstrumentSerif-OFL.txt). Build-time only;
// nothing here ships to the browser.

import { readFile } from "node:fs/promises";
import { APP_NAME } from "@admitstory/shared/brand";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "#0B0A09";
const FG = "#F4F1EA";
const FG_60 = "rgba(244,241,234,0.6)";
const LINE = "rgba(244,241,234,0.2)";
const BRASS = "#E2B36B";

export interface OgInput {
  /** The headline's plain line, then its accent line. */
  lead: string;
  accent: string;
  /** The page's path, shown small under the horizon ("/pricing"). */
  path: string;
}

async function fonts() {
  const [geist, mono, serif] = await Promise.all([
    readFile(
      new URL(
        "../../../../node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../../../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf",
        import.meta.url,
      ),
    ),
    readFile(new URL("./InstrumentSerif-Italic.ttf", import.meta.url)),
  ]);
  return [
    { name: "Geist", data: geist, weight: 500 as const, style: "normal" as const },
    { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
    { name: "Instrument Serif", data: serif, weight: 400 as const, style: "italic" as const },
  ];
}

/** The mark: the Voiceline making its peak (BrandMark in @admitstory/ui), in a 24 box. */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 16 H8.4 L12 5.5 L15.6 16 H22"
        stroke={BRASS}
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export async function ogImage({ lead, accent, path }: OgInput) {
  const { width, height } = OG_SIZE;
  // The horizon, 132px above the foot, with one peak (the mark's rise) at 72% of the width.
  const y = height - 132;
  const peakX = Math.round(width * 0.72);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: BG,
        color: FG,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 72,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 34,
          letterSpacing: "-0.02em",
        }}
      >
        <Mark size={40} />
        <span style={{ display: "flex", alignItems: "baseline" }}>
          <span>Admit</span>
          <span style={{ fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 38 }}>
            Stories
          </span>
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: 196,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span style={{ fontSize: 92, lineHeight: 0.98, letterSpacing: "-0.045em" }}>{lead}</span>
        <span
          style={{
            fontFamily: "Instrument Serif",
            fontStyle: "italic",
            fontSize: 98,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: FG_60,
          }}
        >
          {accent}
        </span>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <path
          d={`M0 ${y} H${peakX - 21} M${peakX + 21} ${y} H${width}`}
          stroke={LINE}
          strokeWidth="2"
        />
        <path
          d={`M${peakX - 21} ${y} L${peakX} ${y - 60} L${peakX + 21} ${y}`}
          stroke={BRASS}
          strokeWidth="2.5"
          fill="none"
          strokeLinejoin="miter"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          right: 72,
          bottom: 72,
          display: "flex",
          fontFamily: "Geist Mono",
          fontSize: 22,
          letterSpacing: "0.04em",
          color: FG_60,
        }}
      >
        {`admitstories.com${path === "/" ? "" : path}`}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}

export function ogAlt({ lead, accent }: OgInput): string {
  return `${APP_NAME}: ${lead} ${accent}`;
}
