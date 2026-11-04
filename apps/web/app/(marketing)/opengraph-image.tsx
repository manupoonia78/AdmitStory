// The Open Graph image every marketing page inherits (direction §9, plan §9.5.4): Night, "Say one
// thing about yourself." in Geist 600 on the left, the sample applicant's Voiceprint on the right.
// Static (no request APIs), so it's generated once at build.
//
// Satori can't run hooks or read CSS, so the Voiceprint comes from voiceprintStillSvg (the same
// geometry as VoiceprintStill) in the sample hue's Night hex, as an SVG data URI. The font is a
// static asset reference, so the build traces that one file and nothing else.

import { readFile } from "node:fs/promises";
import { APP_NAME } from "@admitstory/shared/brand";
import { THEME_COLORS, paramsFromIdentity, voiceHueAt, voiceprintStillSvg } from "@admitstory/ui";
import { ImageResponse } from "next/og";
import { SAMPLE_IDENTITY } from "./_data/sample";

export const alt = "AdmitStories: say one thing about yourself.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TEXT = "#eef0ff";
const TEXT_SOFT = "#9aa2cc";

/** The sample Voiceprint as a self-contained SVG data URI. */
function voiceprintDataUri(): string {
  const hex = voiceHueAt(paramsFromIdentity(SAMPLE_IDENTITY).hueIndex).night;
  const svg = voiceprintStillSvg(SAMPLE_IDENTITY, hex, 460);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default async function OpengraphImage() {
  const geist = await readFile(
    new URL("../../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf", import.meta.url),
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "72px 72px 72px 88px",
        background: THEME_COLORS.night,
        color: TEXT,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          width: 620,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: "-0.01em",
            color: TEXT_SOFT,
          }}
        >
          {APP_NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 600,
            letterSpacing: "-0.045em",
            lineHeight: 0.98,
          }}
        >
          Say one thing about yourself.
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>, not next/image. */}
      <img src={voiceprintDataUri()} width={460} height={460} alt="" />
    </div>,
    {
      ...size,
      fonts: [{ name: "Geist", data: geist, weight: 600, style: "normal" }],
    },
  );
}
